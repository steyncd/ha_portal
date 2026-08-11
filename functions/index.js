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

// Household allow-list — keep in sync with src/lib/auth.svelte.ts + firestore.rules.
const BOOTSTRAP_OWNERS = ["christosteyn@cloudbadger.com", "steyncd@gmail.com"];

// Verify the caller's Firebase ID token AND that the email is a portal member.
// Authentication alone is not enough: any Google account can mint a valid token
// for this project, so onRequest endpoints that spend Gemini / mutate data must
// also authorize against settings/access (members+owners). Throws on failure;
// err.code is "unauthenticated" (bad/absent token) or "forbidden" (not a member).
async function requireMember(req) {
  const authz = req.headers.authorization || "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(idToken); }
  catch { const e = new Error("unauthenticated"); e.code = "unauthenticated"; throw e; }
  const email = String(decoded.email || "").toLowerCase();
  if (BOOTSTRAP_OWNERS.map((s) => s.toLowerCase()).includes(email)) return decoded;
  let allowed = [];
  try {
    const snap = await db.collection("settings").doc("access").get();
    const d = snap.exists ? snap.data() : {};
    allowed = [...(d.members || []), ...(d.owners || [])].map((s) => String(s).toLowerCase());
  } catch { /* fall through to forbidden */ }
  if (!allowed.includes(email)) { const e = new Error("forbidden"); e.code = "forbidden"; throw e; }
  return decoded;
}
function sendAuthError(res, e) {
  const forbidden = e && e.code === "forbidden";
  res.status(forbidden ? 403 : 401).json({ ok: false, error: forbidden ? "forbidden" : "unauthenticated" });
}

// ---- Life-OS capture: turn "add …/task …/chore …/remind me to …" WhatsApp
// messages into shared life_tasks (Firestore), with a light Gemini parse for
// assignee/kind/points/due. Grammar + helpers live in ./classify (unit-tested).
const { FAM, senderKey, classifyMessage, dueInDaysServer } = require("./classify");

// Core capture: writes the item to Firestore and returns { handled, reply }.
// It does NOT send the confirmation itself — the caller decides how to reply
// (the Firebase-proxy path sends via HA; the HA-brain path returns the text to
// HA, which sends it). This keeps capture working on BOTH inbound entry points.
async function captureCore(message, sender) {
  const c = classifyMessage(message);
  if (!c.kind) return { handled: false, reply: null };

  // Shopping: "buy …/purchase …/pick up …/grab …" -> the shared shopping list.
  if (c.kind === "shop") {
    const it = c.text;
    await db.collection("life_shopping").add({ item: it.slice(0, 120), qty: "", checked: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    logger.info("captured shopping item", { item: it, by: senderKey(sender) });
    return { handled: true, reply: `🛒 On the shopping list: ${it}` };
  }

  const rest = c.text;
  const def = senderKey(sender);
  let item = { title: rest, kind: c.kind, assignee: def, points: 1, due: null };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Turn this into a household task as STRICT JSON: {"title":string,"kind":"task"|"chore","assignee":"christo"|"mandri"|"liam"|"eben"|"","points":number,"due":"YYYY-MM-DD"|null}. Family: Christo, Mandri, Liam (kid), Eben (kid). Assign to a named person, else "". "chore" = a recurring household job; otherwise "task". points: 1-3 for a small chore, 0 otherwise. due: only if a date/day is mentioned, resolved relative to today ${today}. Text: ${rest}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0 } }),
    });
    const j = await r.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t) {
      const p = JSON.parse(t);
      item = {
        title: (p.title || rest).toString().slice(0, 200),
        kind: p.kind === "chore" ? "chore" : "task",
        assignee: FAM.includes(p.assignee) ? p.assignee : def,
        points: Number.isFinite(p.points) ? Math.max(0, Math.min(20, Math.round(p.points))) : 1,
        due: /^\d{4}-\d{2}-\d{2}$/.test(p.due || "") ? p.due : null,
      };
    }
  } catch (e) { logger.warn("capture: parse failed, using raw", String((e && e.message) || e)); }

  await db.collection("life_tasks").add({
    ...item, done: false, doneAt: null, notes: "via WhatsApp",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info("captured life item", { title: item.title, assignee: item.assignee, by: senderKey(sender) });
  const reply = `✅ Added: ${item.title}${item.assignee ? ` → ${item.assignee}` : ""}${item.due ? ` (by ${item.due})` : ""}`;
  return { handled: true, reply };
}

// Firebase-proxy path: capture + send the confirmation via HA. Returns handled.
async function captureLifeItem(message, sender) {
  const { handled, reply } = await captureCore(message, sender);
  if (!handled) return false;
  try {
    await fetch(`${HA_URL.value()}/api/services/script/notify_household`, {
      method: "POST", headers: { Authorization: `Bearer ${HA_TOKEN.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Life", message: reply, priority: "low", channel: "whatsapp", targets: senderKey(sender), force: true }),
    });
  } catch (e) { logger.warn("capture: confirm failed", String((e && e.message) || e)); }
  return true;
}

// HA-brain path: HA's wa_process_message calls this for "add/buy …" messages.
// Secret-gated (same WA_WEBHOOK_SECRET). Writes the item and returns the reply
// text for HA to send — so capture works when TextMeBot posts to the HA webhook.
exports.waCapture = onRequest(
  { secrets: [WA_WEBHOOK_SECRET, HA_URL, HA_TOKEN, GEMINI_API_KEY], region: "us-central1", maxInstances: 3 },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
    const expected = WA_WEBHOOK_SECRET.value();
    if (!expected || req.query.key !== expected) { logger.warn("waCapture: bad key", { ip: req.ip, configured: !!expected }); res.status(403).json({ captured: false }); return; }
    const { message, sender } = req.body || {};
    if (!message) { res.status(400).json({ captured: false }); return; }
    try {
      const { handled, reply } = await captureCore(String(message).slice(0, MAX_LEN), sender || "");
      res.status(200).json({ captured: handled, reply: reply || "" });
    } catch (e) {
      logger.error("waCapture failed", e);
      res.status(500).json({ captured: false, error: "internal error" });
    }
  },
);

exports.waInbound = onRequest(
  { secrets: [HA_URL, HA_TOKEN, WA_WEBHOOK_SECRET, GEMINI_API_KEY], region: "us-central1", maxInstances: 3 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }
    const expected = WA_WEBHOOK_SECRET.value();
    if (!expected || req.query.key !== expected) {
      logger.warn("waInbound: bad key", { ip: req.ip, configured: !!expected });
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

    // Life-OS capture: "add …/task …/chore …/remind me to …" goes straight to the
    // shared list (and confirms via WhatsApp), skipping the normal HA routing.
    try {
      if (await captureLifeItem(message, sender)) { res.status(200).send("captured"); return; }
    } catch (e) {
      logger.error("waInbound: capture failed", e);
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
    // caller must be a signed-in portal MEMBER (not just any Google account)
    let user;
    try { user = await requireMember(req); }
    catch (e) { sendAuthError(res, e); return; }

    const { fileBase64, mimeType, kind } = req.body || {};
    if (!fileBase64 || !mimeType) { res.status(400).json({ ok: false, error: "missing file/mimeType" }); return; }

    const schema = kind === "receipt"
      ? '{"type":"receipt","merchant":string|null,"date":"YYYY-MM-DD"|null,"total":number|null,"currency":string|null,"category":string|null,"items":[{"name":string,"price":number}]}'
      : kind === "renewal"
      ? '{"type":"renewal","label":string|null,"expiry_date":"YYYY-MM-DD"|null,"category":string|null}'
      : '{"type":"statement","provider":string|null,"account":string|null,"value":number|null,"currency":string|null,"statement_date":"YYYY-MM-DD"|null}';
    const prompt = `You are a precise data extractor. Extract the ${kind || "document"} as STRICT JSON matching this shape: ${schema}. Amounts must be plain numbers (no currency symbols, no thousands separators). Use null for anything not present. For a retirement/investment statement, "value" is the current total fund/portfolio value. For a renewal/expiry document (vehicle licence, insurance, warranty, policy), "label" is a short human name for it (e.g. "Vehicle licence disc", "Home insurance") and "expiry_date" is the date it expires or must be renewed by. Respond with JSON only.`;

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
      res.status(500).json({ ok: false, error: "internal error" });
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
    try { await requireMember(req); }
    catch (e) { sendAuthError(res, e); return; }
    try { await refreshAllParcels(); res.status(200).json({ ok: true }); }
    catch (e) { logger.error("refreshParcelsNow failed", e); res.status(500).json({ ok: false, error: "internal error" }); }
  },
);

// ============================================================================
// Life OS — Phase 3 background helpers (auto-journal, bill-due alerts) + the
// meal→shopping expander. Shared HA + Gemini plumbing lives here.
// ============================================================================
async function haFetch(path, init) {
  return fetch(`${HA_URL.value()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${HA_TOKEN.value()}`, "Content-Type": "application/json", ...(init && init.headers) },
  });
}
async function haNotify({ title, message, targets = "christo", channel = "whatsapp", priority = "normal" }) {
  try {
    await haFetch("/api/services/script/notify_household", {
      method: "POST",
      body: JSON.stringify({ title, message, targets, channel, priority, force: true }),
    });
  } catch (e) { logger.warn("haNotify failed", String((e && e.message) || e)); }
}
async function haStates() {
  try { const r = await haFetch("/api/states", { method: "GET" }); return r.ok ? await r.json() : []; }
  catch (e) { logger.warn("haStates failed", String((e && e.message) || e)); return []; }
}
async function geminiText(prompt, { temperature = 0.5 } = {}) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `gemini ${r.status}`);
  return (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

// ---- Auto-journal: nightly, compose a short reflective home+life log entry ----
async function writeJournal() {
  const states = await haStates();
  const byId = Object.fromEntries(states.map((s) => [s.entity_id, s]));
  // Curated candidate signals — only those that actually resolve are included,
  // so a renamed/absent entity is silently skipped (never a wrong fact).
  const wanted = [
    ["sensor.energy_cost_today", "electricity spent today"],
    ["sensor.water_pumped_today", "water pumped today"],
    ["sensor.home_occupancy", "who was home"],
    ["sensor.coffee_log", "coffees"],
    ["sensor.power_breakdown_summary", "power use"],
    ["weather.forecast_home", "weather"],
    ["sensor.outside_temperature", "outside temperature"],
    ["alarm_control_panel.home_alarm", "alarm state"],
    ["alarm_control_panel.helloliam_alarm", "alarm state"],
    ["sensor.gate_events_today", "gate activity"],
    ["sensor.sidewalk_vehicles_today", "vehicles past the house"],
  ];
  const facts = [];
  for (const [id, label] of wanted) {
    const s = byId[id];
    if (!s || s.state == null || ["unknown", "unavailable", ""].includes(String(s.state))) continue;
    const unit = s.attributes?.unit_of_measurement ? ` ${s.attributes.unit_of_measurement}` : "";
    facts.push(`- ${label}: ${s.state}${unit}`);
  }
  // Family board: how many items were ticked off today. Bounded query on doneAt
  // (the field the task store actually writes — was mis-read as completedAt, and
  // scanned the whole collection) so this never grows unbounded.
  let doneToday = 0;
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const snap = await db.collection("life_tasks")
      .where("doneAt", ">=", admin.firestore.Timestamp.fromDate(start))
      .get();
    snap.forEach((d) => { if (d.data().done) doneToday++; });
  } catch { /* non-fatal (e.g. index still building) */ }
  if (doneToday) facts.push(`- family board: ${doneToday} item(s) ticked off today`);

  if (!facts.length) { logger.info("writeJournal: no facts, skipping"); return null; }
  const prompt = `You are the quiet house journal for the Steyn family home. Using ONLY these facts from today, write a warm, concise 2–3 sentence diary entry in the past tense, as if the house is reflecting on the day. No greeting, no bullet points, no headings, no made-up details.\n\nFacts:\n${facts.join("\n")}`;
  let text;
  try { text = await geminiText(prompt, { temperature: 0.6 }); }
  catch (e) { logger.error("writeJournal gemini failed", String((e && e.message) || e)); return null; }
  if (!text) return null;
  const dateKey = new Date().toISOString().slice(0, 10);
  await db.collection("life_journal").doc(dateKey).set({
    date: dateKey, text, factCount: facts.length, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info("writeJournal wrote entry", { dateKey, facts: facts.length });
  return text;
}

exports.journalDaily = onSchedule(
  { schedule: "0 22 * * *", timeZone: "Africa/Johannesburg", secrets: [HA_URL, HA_TOKEN, GEMINI_API_KEY], region: "us-central1", maxInstances: 1 },
  async () => { await writeJournal(); },
);
exports.journalNow = onRequest(
  { secrets: [HA_URL, HA_TOKEN, GEMINI_API_KEY], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    try { await requireMember(req); }
    catch (e) { sendAuthError(res, e); return; }
    try { const text = await writeJournal(); res.status(200).json({ ok: true, text }); }
    catch (e) { logger.error("journalNow failed", e); res.status(500).json({ ok: false, error: "internal error" }); }
  },
);

// ---- Bill-due alerts: each morning, WhatsApp the unpaid bills due within 3 days ----
async function checkBillsDue() {
  const snap = await db.collection("life_bills").get();
  const mkey = new Date().toISOString().slice(0, 7);
  const now = Date.now();
  const due = [];
  snap.forEach((d) => {
    const x = d.data();
    if (x.autopay) return;                       // autopay bills look after themselves
    if ((x.paidMonth || "") === mkey) return;    // already paid this month
    const days = dueInDaysServer(Number(x.dueDay || 1), now);
    if (days <= 3) due.push({ name: x.name || "Bill", amount: Number(x.amount || 0), days });
  });
  if (!due.length) { logger.info("checkBillsDue: nothing due"); return 0; }
  due.sort((a, b) => a.days - b.days);
  const fmt = (n) => `R${Math.round(n).toLocaleString("en-ZA")}`;
  const lines = due.map((b) => `• ${b.name} — ${fmt(b.amount)} ${b.days === 0 ? "due today" : b.days === 1 ? "due tomorrow" : `in ${b.days} days`}`);
  const total = due.reduce((s, b) => s + b.amount, 0);
  await haNotify({
    title: "💳 Bills due soon",
    message: `${lines.join("\n")}\n\nTotal: ${fmt(total)}`,
    targets: "christo", channel: "whatsapp", priority: "normal",
  });
  logger.info("checkBillsDue notified", { count: due.length });
  return due.length;
}

exports.billsDueDaily = onSchedule(
  { schedule: "0 7 * * *", timeZone: "Africa/Johannesburg", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await checkBillsDue(); },
);

// ---- Meal → shopping: expand the week's meal plan into grocery items ----
exports.mealsToShopping = onRequest(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
    try { await requireMember(req); }
    catch (e) { sendAuthError(res, e); return; }
    try {
      const doc = await db.collection("life_meals").doc("current").get();
      const data = doc.exists ? doc.data() : {};
      const meals = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        .map((d) => (data[d] || "").toString().trim()).filter(Boolean);
      if (!meals.length) { res.status(200).json({ ok: true, added: 0, note: "no meals planned" }); return; }

      const prompt = `You are a grocery planner. Given this week's planned meals, list the grocery ingredients needed to cook them for a family. Combine duplicates, use common household quantities, and skip staples most kitchens always have (salt, pepper, water, cooking oil). Respond with STRICT JSON: {"items":[{"item":string,"qty":string}]}. Meals:\n${meals.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0.2 } }),
      });
      const j = await r.json();
      if (!r.ok) { res.status(502).json({ ok: false, error: j?.error?.message || `gemini ${r.status}` }); return; }
      let parsed; try { parsed = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"); } catch { parsed = {}; }
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      if (!items.length) { res.status(200).json({ ok: true, added: 0, note: "no ingredients derived" }); return; }

      // Dedup against what's already on the (unchecked) list.
      const existingSnap = await db.collection("life_shopping").get();
      const have = new Set(existingSnap.docs.map((d) => (d.data().item || "").toString().trim().toLowerCase()));
      const batch = db.batch();
      let added = 0;
      for (const it of items) {
        const name = (it.item || "").toString().trim();
        if (!name || have.has(name.toLowerCase())) continue;
        const ref = db.collection("life_shopping").doc();
        batch.set(ref, { item: name.slice(0, 120), qty: (it.qty || "").toString().slice(0, 40), checked: false, source: "meals", createdAt: admin.firestore.FieldValue.serverTimestamp() });
        have.add(name.toLowerCase()); added++;
      }
      if (added) await batch.commit();
      logger.info("mealsToShopping", { meals: meals.length, added });
      res.status(200).json({ ok: true, added });
    } catch (e) {
      logger.error("mealsToShopping failed", e);
      res.status(500).json({ ok: false, error: "internal error" });
    }
  },
);
