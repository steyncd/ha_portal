// Public webhook proxy: TextMeBot -> Firebase -> Home Assistant.
//
// TextMeBot POSTs each inbound WhatsApp message here. We validate + rate-limit,
// then forward to HA's authenticated REST API (reliable over Nabu Casa remote),
// calling script.wa_process_message — the routing brain in Home Assistant.
//
// Hardening: POST-only, shared-secret key, per-sender rate limit (Firestore
// sliding window), message-length cap, capped instances, structured logging.
// The sender allow-list (the actual authorization) lives in HA and is editable
// from the portal (Settings -> WhatsApp).
//
// Secrets (firebase functions:secrets:set NAME): HA_URL, HA_TOKEN, WA_WEBHOOK_SECRET
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { Firestore } = require("@google-cloud/firestore");

admin.initializeApp();
const db = admin.firestore();

// HQ finance app lives in its own project; the function's service account needs
// roles/datastore.viewer on it to read the money summary (see README/deploy note).
const HQ_PROJECT = "steyn-family-finance";

const HA_URL = defineSecret("HA_URL");
const HA_TOKEN = defineSecret("HA_TOKEN");
const WA_WEBHOOK_SECRET = defineSecret("WA_WEBHOOK_SECRET");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const SHIP24_KEY = defineSecret("SHIP24_KEY");

const RATE_LIMIT = 30; // max messages per sender per rolling minute
const WINDOW_MS = 60_000;
const MAX_LEN = 1000; // cap message length before it reaches HA/Gemini

exports.waInbound = onRequest(
  { secrets: [HA_URL, HA_TOKEN, WA_WEBHOOK_SECRET], region: "us-central1", maxInstances: 3 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }
    const expected = WA_WEBHOOK_SECRET.value();
    if (expected && req.query.key !== expected) {
      logger.warn("waInbound: bad key", { ip: req.ip });
      res.status(403).send("forbidden");
      return;
    }

    const b = req.body || {};
    let message = (b.message || b.text || b.body || b.Body || "").toString().trim();
    const sender = (b.from || b.sender || b.From || "").toString();
    if (!message) {
      res.status(200).send("no message");
      return;
    }
    if (message.length > MAX_LEN) message = message.slice(0, MAX_LEN);

    // Per-sender sliding-window rate limit (fails open on infra error).
    const sd = (sender.match(/\d+/g) || []).join("") || "unknown";
    try {
      const ref = db.collection("waRate").doc(sd);
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const nowMs = Date.now();
        let { count = 0, windowStart = nowMs } = snap.exists ? snap.data() : {};
        if (nowMs - windowStart > WINDOW_MS) { count = 0; windowStart = nowMs; }
        count += 1;
        tx.set(ref, { count, windowStart });
        return count <= RATE_LIMIT;
      });
      if (!ok) {
        logger.warn("waInbound: rate limited", { sender: sd });
        res.status(429).send("rate limited");
        return;
      }
    } catch (e) {
      logger.error("waInbound: rate check failed (allowing)", e);
    }

    try {
      const r = await fetch(`${HA_URL.value()}/api/services/script/wa_process_message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${HA_TOKEN.value()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message, sender }),
      });
      logger.info("waInbound: forwarded", { sender: sd, len: message.length, status: r.status });
      res.status(200).send(r.ok ? "ok" : `ha ${r.status}`);
    } catch (e) {
      logger.error("waInbound: forward failed", e);
      res.status(200).send("error"); // 200 so TextMeBot doesn't retry-storm
    }
  },
);

// ---- Life-OS glue: push HQ money figures into Home Assistant ----
async function pushMoneyToHA() {
  const hq = new Firestore({ projectId: HQ_PROJECT });
  const [sumSnap, assetsSnap] = await Promise.all([
    hq.collection("summaries").doc("latest").get(),
    hq.collection("settings").doc("assets").get(),
  ]);
  const sum = sumSnap.data() || {};
  const accounts = sum.accounts || [];
  let bank = 0, liab = 0;
  for (const a of accounts) {
    const bal = Number(a.balance) || 0;
    if (bal >= 0) bank += bal; else liab += -bal;
  }
  const man = ((assetsSnap.data() || {}).items || []).reduce((t, a) => t + (Number(a.value) || 0), 0);
  const netWorth = Math.round(bank + man - liab);
  const totalBalance = Math.round(Number(sum.totalBalance) || bank);
  const available = Math.round(Number(sum.totalAvailable) || 0);

  const call = (domain, service, data) =>
    fetch(`${HA_URL.value()}/api/services/${domain}/${service}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HA_TOKEN.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const setNum = (id, value) => call("input_number", "set_value", { entity_id: id, value });

  await Promise.all([
    setNum("input_number.hq_net_worth", netWorth),
    setNum("input_number.hq_total_balance", totalBalance),
    setNum("input_number.hq_available", available),
    call("input_text", "set_value", {
      entity_id: "input_text.hq_updated",
      value: new Date().toISOString().slice(0, 16).replace("T", " "),
    }),
  ]);
  logger.info("syncMoneyToHA", { netWorth, totalBalance, available, accounts: accounts.length });
  return { netWorth, totalBalance, available, accounts: accounts.length };
}

exports.syncMoneyToHA = onSchedule(
  { schedule: "every 60 minutes", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await pushMoneyToHA(); },
);

// Secret-gated on-demand trigger (for testing + a "sync now" button).
exports.syncMoneyNow = onRequest(
  { secrets: [HA_URL, HA_TOKEN, WA_WEBHOOK_SECRET], region: "us-central1", maxInstances: 1 },
  async (req, res) => {
    if (req.query.key !== WA_WEBHOOK_SECRET.value()) { res.status(403).send("forbidden"); return; }
    try {
      const r = await pushMoneyToHA();
      res.status(200).json({ ok: true, ...r });
    } catch (e) {
      logger.error("syncMoneyNow failed", e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  },
);

// ---- Web push fan-out: send a notification to all registered portal devices ----
exports.sendPush = onRequest(
  { secrets: [WA_WEBHOOK_SECRET], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const key = req.query.key || (req.body && req.body.key);
    if (key !== WA_WEBHOOK_SECRET.value()) { res.status(403).send("forbidden"); return; }
    const p = { ...req.query, ...(req.body || {}) };
    const title = (p.title || "Steyn Home").toString();
    const body = (p.body || p.message || "").toString();
    const tag = p.tag ? p.tag.toString() : undefined;

    const snap = await db.collection("pushTokens").get();
    const tokens = snap.docs.map((d) => d.id);
    if (!tokens.length) { res.status(200).json({ sent: 0, note: "no registered devices" }); return; }

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { notification: { icon: "/favicon.svg", tag }, fcmOptions: { link: "/" } },
      data: tag ? { tag } : {},
    });
    // prune dead tokens
    const dead = [];
    resp.responses.forEach((r, i) => {
      if (!r.success && ["messaging/registration-token-not-registered", "messaging/invalid-argument"].includes(r.error?.code)) dead.push(tokens[i]);
    });
    await Promise.all(dead.map((t) => db.collection("pushTokens").doc(t).delete()));
    logger.info("sendPush", { sent: resp.successCount, failed: resp.failureCount, pruned: dead.length });
    res.status(200).json({ sent: resp.successCount, failed: resp.failureCount, pruned: dead.length });
  },
);

// ---- Receipt / statement parsing via Gemini vision ----
// Portal (authed user) POSTs { fileBase64, mimeType, kind } → structured JSON,
// stored in Firestore `documents`. Statements can feed net worth; receipts spend.
exports.parseDocument = onRequest(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 3 },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
    // caller must be a signed-in portal user (Firebase ID token)
    const authz = req.headers.authorization || "";
    const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    let user;
    try { user = await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }

    const { fileBase64, mimeType, kind } = req.body || {};
    if (!fileBase64 || !mimeType) { res.status(400).json({ ok: false, error: "missing file/mimeType" }); return; }

    const schema = kind === "receipt"
      ? '{"type":"receipt","merchant":string|null,"date":"YYYY-MM-DD"|null,"total":number|null,"currency":string|null,"category":string|null,"items":[{"name":string,"price":number}]}'
      : '{"type":"statement","provider":string|null,"account":string|null,"value":number|null,"currency":string|null,"statement_date":"YYYY-MM-DD"|null}';
    const prompt = `You are a precise data extractor. Extract the ${kind || "document"} as STRICT JSON matching this shape: ${schema}. Amounts must be plain numbers (no currency symbols, no thousands separators). Use null for anything not present. For a retirement/investment statement, "value" is the current total fund/portfolio value. Respond with JSON only.`;

    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: prompt }] }],
          generationConfig: { response_mime_type: "application/json", temperature: 0 },
        }),
      });
      const j = await r.json();
      if (!r.ok) { logger.error("gemini error", j); res.status(502).json({ ok: false, error: j?.error?.message || `gemini ${r.status}` }); return; }
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let extracted;
      try { extracted = JSON.parse(text); } catch { extracted = { raw: text }; }
      const ref = await db.collection("documents").add({
        kind: kind || "document", extracted, uploadedBy: user.email || user.uid, ts: Date.now(),
      });
      logger.info("parseDocument", { kind, id: ref.id, by: user.email });
      res.status(200).json({ ok: true, id: ref.id, extracted });
    } catch (e) {
      logger.error("parseDocument failed", e);
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  },
);

// ---- Ship24 parcel tracking: refresh all tracked parcels' status ----
async function refreshAllParcels() {
  const snap = await db.collection("parcels").get();
  for (const doc of snap.docs) {
    const tn = (doc.data().trackingNumber || "").toString().trim();
    if (!tn) continue;
    try {
      const r = await fetch("https://api.ship24.com/public/v1/trackers/track", {
        method: "POST",
        headers: { Authorization: `Bearer ${SHIP24_KEY.value()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: tn }),
      });
      const j = await r.json();
      const t = j?.data?.trackings?.[0];
      const milestone = t?.shipment?.statusMilestone || "pending";
      const ev = (t?.events || [])[0];
      await doc.ref.set({
        status: milestone,
        courier: (t?.tracker?.courierCode || [])[0] || null,
        lastEvent: ev ? `${ev.status || ""}${ev.location ? " · " + ev.location : ""}`.trim() : null,
        delivered: milestone === "delivered",
        refreshedAt: Date.now(),
      }, { merge: true });
    } catch (e) {
      logger.error("ship24 refresh failed", { tn, e: String((e && e.message) || e) });
    }
  }
}

exports.refreshParcels = onSchedule(
  { schedule: "every 120 minutes", secrets: [SHIP24_KEY], region: "us-central1", maxInstances: 1 },
  async () => { await refreshAllParcels(); },
);

exports.refreshParcelsNow = onRequest(
  { secrets: [SHIP24_KEY], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    try { await refreshAllParcels(); res.status(200).json({ ok: true }); }
    catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  },
);
