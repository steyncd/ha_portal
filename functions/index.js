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
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { Firestore } = require("@google-cloud/firestore");
const { BigQuery } = require("@google-cloud/bigquery");

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
const TMDB_KEY = defineSecret("TMDB_KEY");
const TIDAL_CLIENT_ID = defineSecret("TIDAL_CLIENT_ID");
const TIDAL_CLIENT_SECRET = defineSecret("TIDAL_CLIENT_SECRET");
const TRELLO_KEY = defineSecret("TRELLO_KEY");
const TRELLO_TOKEN = defineSecret("TRELLO_TOKEN");

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

// ---- Trello proxy: read boards/lists/cards + manage cards via the Trello REST
// API, with the key/token kept server-side. Any signed-in portal user may call.
// The HA "ha-trello" integration is read-only (counts only), so card contents
// and mutations go straight to api.trello.com through here.
exports.trelloApi = onRequest(
  { secrets: [TRELLO_KEY, TRELLO_TOKEN], region: "us-central1", maxInstances: 5 },
  async (req, res) => {
    const authz = req.headers.authorization || "";
    const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }

    const key = TRELLO_KEY.value(), token = TRELLO_TOKEN.value();
    if (!key || !token) { res.status(500).json({ ok: false, error: "Trello key/token not configured" }); return; }
    const auth = `key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    const base = "https://api.trello.com/1";
    const call = async (method, path, extra) => {
      const url = `${base}${path}${path.includes("?") ? "&" : "?"}${auth}`;
      const r = await fetch(url, { method, ...(extra || {}) });
      const text = await r.text();
      let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!r.ok) throw new Error((body && body.message) || `Trello ${r.status}`);
      return body;
    };
    try {
      const action = (req.query.action || (req.body && req.body.action) || "").toString();
      if (req.method === "GET" && action === "boards") {
        const boards = await call("GET", "/members/me/boards?filter=open&fields=name,id,prefs");
        res.json({ ok: true, boards: (boards || []).map((b) => ({ id: b.id, name: b.name })) });
        return;
      }
      if (req.method === "GET" && action === "board") {
        const boardId = (req.query.boardId || "").toString();
        if (!boardId) { res.status(400).json({ ok: false, error: "missing boardId" }); return; }
        const lists = await call("GET", `/boards/${boardId}/lists?filter=open&fields=name,pos&cards=open&card_fields=name,due,dueComplete,labels,shortUrl,idList,pos`);
        res.json({ ok: true, lists });
        return;
      }
      if (req.method === "POST") {
        const d = req.body || {};
        if (action === "create") {
          const q = new URLSearchParams({ idList: d.listId, name: d.name || "New card", pos: d.pos || "bottom" });
          if (d.due) q.set("due", d.due);
          const card = await call("POST", `/cards?${q.toString()}`);
          res.json({ ok: true, card });
          return;
        }
        if (action === "move") {
          const q = new URLSearchParams({ idList: d.destListId });
          if (d.pos) q.set("pos", String(d.pos));
          const card = await call("PUT", `/cards/${d.cardId}?${q.toString()}`);
          res.json({ ok: true, card });
          return;
        }
        if (action === "complete") {
          const card = await call("PUT", `/cards/${d.cardId}?dueComplete=${d.dueComplete ? "true" : "false"}`);
          res.json({ ok: true, card });
          return;
        }
        if (action === "archive") {
          const card = await call("PUT", `/cards/${d.cardId}?closed=${d.closed === false ? "false" : "true"}`);
          res.json({ ok: true, card });
          return;
        }
        if (action === "rename") {
          const card = await call("PUT", `/cards/${d.cardId}?name=${encodeURIComponent(d.name || "")}`);
          res.json({ ok: true, card });
          return;
        }
      }
      res.status(400).json({ ok: false, error: "unknown action" });
    } catch (e) {
      logger.error("trelloApi failed", e);
      res.status(502).json({ ok: false, error: String((e && e.message) || e) });
    }
  },
);

// ---- Watchlist: AI content analysis (Gemini) for a film ----
// Callable by watchlist admins only. Returns a structured discernment breakdown
// so every title is screened before it's added to the list.
const WA_BOOTSTRAP_ADMINS = ["christosteyn@cloudbadger.com", "steyncd@gmail.com"];
// Shared access helpers for the watchlist/screening-room callables.
async function waRoles(email) {
  if (!email) return { allowed: false, admin: false };
  if (WA_BOOTSTRAP_ADMINS.includes(email)) return { allowed: true, admin: true };
  try {
    const s = await db.doc("watchlist/access").get();
    const d = (s.exists && s.data()) || {};
    const admins = (d.admins || []).map((x) => String(x).toLowerCase());
    const all = [...admins, ...((d.allowed || []).map((x) => String(x).toLowerCase()))];
    return { allowed: all.includes(email), admin: admins.includes(email) };
  } catch { return { allowed: false, admin: false }; }
}
exports.analyzeMovie = onCall(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (!email) throw new HttpsError("unauthenticated", "Sign in required.");
    let isAdmin = WA_BOOTSTRAP_ADMINS.includes(email);
    if (!isAdmin) {
      try {
        const snap = await db.doc("watchlist/access").get();
        const admins = ((snap.exists && snap.data().admins) || []).map((x) => String(x).toLowerCase());
        isAdmin = admins.includes(email);
      } catch { /* deny below */ }
    }
    if (!isAdmin) throw new HttpsError("permission-denied", "Admins only.");

    const title = String((request.data && request.data.title) || "").trim();
    const year = String((request.data && request.data.year) || "").trim();
    const kind = String((request.data && request.data.type) || "movie").trim() === "series" ? "series" : "film";
    if (!title) throw new HttpsError("invalid-argument", "Title required.");

    const prompt = `You are screening ${kind === "series" ? "TV series" : "films"} for a **Reformed Christian family in South Africa with a biblical-creationist worldview**. Their #1 filter: AVOID occult, demonic, witchcraft and mystical "power/sorcery" content. A dark or serious TONE is fine — that is NOT the filter. The household is two parents and two sons, **Liam (11) and Eben (8)**.

Analyse the ${kind} "${title}"${year ? " (" + year + ")" : ""}${kind === "series" ? " (assess the series overall across its seasons)" : ""} and return STRICT JSON only.

Rating rules:
- "green" = clean of occult/demonic/sorcery content.
- "amber" = a mythic/magic/spiritual element that is a discernment call (e.g. Norse 'gods' framed as aliens, 'the Force', Greek mythology, Christian allegory involving magic, Eastern 'chi'/spirit content). ALSO treat a strongly naturalistic/evolutionary "millions of years"/molecules-to-man origins message as a worldview discernment point (note it in 'spiritual'), given the family's biblical-creationist beliefs.
- "red" = contains real occult/demonic/witchcraft/sorcery content (spells, demons, hell-pacts, mediums, séances, curses, etc.).

suits (judge for boys aged 8 and 11): "all" (fine for the whole family including the 8-year-old), "boys" (fine for the boys — comic-book/adventure action and tension are OK for them, but not for very young kids), "alone" (too mature/intense/graphic for an 8-11 year old — parents only, e.g. R-rated, heavy gore, sexual content, real horror). Comic-book superhero and sci-fi action (e.g. Transformers, Captain America) is generally fine for these boys.
languageFlag: "filter" if there is notable strong language OR ANY blasphemy / misuse of God's or Jesus' name; otherwise "clean".

For each field give ONE concise, specific sentence (write "None." if genuinely none):
- tone: the overall mood/feel in a few words (e.g. "Lighthearted and comedic", "Dark and intense", "Warm and heartfelt", "Thrilling / suspenseful", "Scary / horror", "Epic adventure", "Romantic"). Always fill this — never "None."
- spiritual: religious/spiritual elements or worldview.
- occult: occult/demonic/witchcraft/sorcery content specifically (the family's key filter).
- violence: level and nature of violence.
- sex: sexual content, nudity or innuendo.
- themes: mature themes not suitable for younger kids (grief, terror, disturbing content).
- language: strong language; CALL OUT blasphemy / misuse of God's or Jesus' name specifically if present.
summary: one plain-language sentence for the parents.`;

    const schema = {
      type: "object",
      properties: {
        rating: { type: "string", enum: ["green", "amber", "red"] },
        suits: { type: "string", enum: ["all", "boys", "alone"] },
        languageFlag: { type: "string", enum: ["clean", "filter"] },
        summary: { type: "string" },
        analysis: {
          type: "object",
          properties: {
            tone: { type: "string" }, spiritual: { type: "string" }, occult: { type: "string" }, violence: { type: "string" },
            sex: { type: "string" }, themes: { type: "string" }, language: { type: "string" },
          },
          required: ["tone", "spiritual", "occult", "violence", "sex", "themes", "language"],
        },
      },
      required: ["rating", "suits", "languageFlag", "summary", "analysis"],
    };

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json", response_schema: schema, temperature: 0.2 },
    });
    // Retry on transient overload (503/429) with backoff, and fall back through
    // alternate flash models if one is overloaded or unavailable.
    const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    let data = null, lastErr = "";
    for (const model of models) {
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body,
        });
        const jr = await r.json();
        if (r.ok) { data = jr; break; }
        lastErr = (jr && jr.error && jr.error.message) || `gemini ${r.status}`;
        logger.warn("analyzeMovie gemini attempt failed", { model, attempt, status: r.status, lastErr });
        if (r.status === 503 || r.status === 429) { await sleep(700 * (attempt + 1)); continue; } // transient → retry same model
        break; // non-retryable (e.g. 404 model not found) → try next model
      }
      if (data) break;
    }
    if (!data) throw new HttpsError("unavailable", "The AI is busy right now (" + lastErr + "). Please try again in a moment.");
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || "{}";
    let out;
    try { out = JSON.parse(text); } catch { throw new HttpsError("internal", "Could not parse the AI response."); }
    return out;
  },
);

// ---- Watchlist: on-demand "where to watch" in South Africa (TMDB / JustWatch) ----
// Any allowed watchlist user can query. Returns ZA streaming/rent/buy providers.
exports.whereToWatch = onCall(
  { secrets: [TMDB_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (!email) throw new HttpsError("unauthenticated", "Sign in required.");
    let allowed = WA_BOOTSTRAP_ADMINS.includes(email);
    if (!allowed) {
      try {
        const snap = await db.doc("watchlist/access").get();
        const d = (snap.exists && snap.data()) || {};
        const all = [...(d.admins || []), ...(d.allowed || [])].map((x) => String(x).toLowerCase());
        allowed = all.includes(email);
      } catch { /* deny below */ }
    }
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");

    const rawTitle = String((request.data && request.data.title) || "").trim();
    const year = String((request.data && request.data.year) || "").trim();
    const kind = String((request.data && request.data.type) || "movie") === "series" ? "tv" : "movie";
    if (!rawTitle) throw new HttpsError("invalid-argument", "Title required.");
    // Strip our "(trilogy)"/"(series)" suffixes for a cleaner TMDB search.
    const title = rawTitle.replace(/\s*\((series|trilogy)\)\s*$/i, "").trim();

    // TMDB v4 read access token → Bearer auth on the v3 REST API.
    const headers = { Authorization: `Bearer ${TMDB_KEY.value()}`, "Content-Type": "application/json;charset=utf-8" };
    const q = encodeURIComponent(title);
    const searchUrl = `https://api.themoviedb.org/3/search/${kind}?query=${q}` + (year && kind === "movie" ? `&year=${year}` : "") + `&include_adult=false`;
    const sres = await fetch(searchUrl, { headers });
    const sj = await sres.json();
    if (!sres.ok) { logger.error("tmdb search error", sj); throw new HttpsError("internal", (sj && sj.status_message) || `tmdb ${sres.status}`); }
    const first = (sj.results || [])[0];
    if (!first) return { found: false };

    const pres = await fetch(`https://api.themoviedb.org/3/${kind}/${first.id}/watch/providers`, { headers });
    const pj = await pres.json();
    const za = (pj && pj.results && pj.results.ZA) || null;
    const names = (arr) => (arr || []).map((p) => p.provider_name);
    return {
      found: true,
      matched: first.title || first.name || title,
      link: (za && za.link) || null,
      flatrate: za ? names(za.flatrate) : [],
      rent: za ? names(za.rent) : [],
      buy: za ? names(za.buy) : [],
    };
  },
);

// ---- Watchlist: TMDB title search (autocomplete for adding titles) ----
// Any allowed watchlist user can query; returns up to 8 real film/series matches
// so the add-title form can only add titles that actually exist.
exports.tmdbSearch = onCall(
  { secrets: [TMDB_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (!email) throw new HttpsError("unauthenticated", "Sign in required.");
    let allowed = WA_BOOTSTRAP_ADMINS.includes(email);
    if (!allowed) {
      try {
        const snap = await db.doc("watchlist/access").get();
        const d = (snap.exists && snap.data()) || {};
        const all = [...(d.admins || []), ...(d.allowed || [])].map((x) => String(x).toLowerCase());
        allowed = all.includes(email);
      } catch { /* deny below */ }
    }
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");

    const q = String((request.data && request.data.query) || "").trim();
    if (q.length < 2) return { results: [] };

    const headers = { Authorization: `Bearer ${TMDB_KEY.value()}`, "Content-Type": "application/json;charset=utf-8" };
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false&page=1`;
    const r = await fetch(url, { headers });
    const j = await r.json();
    if (!r.ok) { logger.error("tmdbSearch error", j); throw new HttpsError("internal", (j && j.status_message) || `tmdb ${r.status}`); }
    const results = (j.results || [])
      .filter((x) => x.media_type === "movie" || x.media_type === "tv")
      .slice(0, 8)
      .map((x) => {
        const isTv = x.media_type === "tv";
        const date = (isTv ? x.first_air_date : x.release_date) || "";
        return {
          tmdbId: x.id,
          title: isTv ? (x.name || "") : (x.title || ""),
          year: date ? Number(date.slice(0, 4)) : null,
          type: isTv ? "series" : "movie",
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w92${x.poster_path}` : null,
          overview: x.overview || "",
        };
      })
      .filter((x) => x.title);
    return { results };
  },
);

// ---- Screening Room: "Talk about it" worldview/discussion companion ----
exports.discussTitle = onCall(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { allowed } = await waRoles(email);
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");
    const title = String((request.data && request.data.title) || "").trim();
    const year = String((request.data && request.data.year) || "").trim();
    const kind = String((request.data && request.data.type) || "movie") === "series" ? "series" : "film";
    if (!title) throw new HttpsError("invalid-argument", "Title required.");
    const prompt = `A Reformed Christian family (biblical-creationist worldview; parents + boys aged 8 and 11) is about to watch the ${kind} "${title}"${year ? " (" + year + ")" : ""}. Help them watch with discernment. Return STRICT JSON only:
{"worldview":"<one sentence: the worldview/values the story is told through>","questions":["<3-4 age-appropriate discussion questions to ask the boys afterward>"],"verse":"<one fitting Bible reference + very short phrase, e.g. 'Philippians 4:8 — dwell on what is true and lovely'>","aligns":"<one sentence: where it aligns with a biblical worldview>","conflicts":"<one sentence: where it conflicts or needs care, or 'Little to flag.'>"}`;
    const schema = { type: "object", properties: { worldview: { type: "string" }, questions: { type: "array", items: { type: "string" } }, verse: { type: "string" }, aligns: { type: "string" }, conflicts: { type: "string" } }, required: ["worldview", "questions", "verse", "aligns", "conflicts"] };
    const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", response_schema: schema, temperature: 0.4 } });
    let data = null, lastErr = "";
    for (const model of models) {
      for (let a = 0; a < 3 && !data; a++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        const jr = await r.json();
        if (r.ok) { data = jr; break; }
        lastErr = (jr && jr.error && jr.error.message) || `gemini ${r.status}`;
        if (r.status === 503 || r.status === 429) { await sleep(700 * (a + 1)); continue; }
        break;
      }
      if (data) break;
    }
    if (!data) throw new HttpsError("unavailable", "The AI is busy (" + lastErr + "). Try again shortly.");
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || "{}";
    try { return JSON.parse(text); } catch { throw new HttpsError("internal", "Could not parse the AI response."); }
  },
);

// ---- Screening Room: TMDB "similar titles" ----
exports.similarTitles = onCall(
  { secrets: [TMDB_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { allowed } = await waRoles(email);
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");
    const rawTitle = String((request.data && request.data.title) || "").trim();
    const year = String((request.data && request.data.year) || "").trim();
    const kind = String((request.data && request.data.type) || "movie") === "series" ? "tv" : "movie";
    if (!rawTitle) throw new HttpsError("invalid-argument", "Title required.");
    const title = rawTitle.replace(/\s*\((series|trilogy)\)\s*$/i, "").trim();
    const headers = { Authorization: `Bearer ${TMDB_KEY.value()}`, "Content-Type": "application/json;charset=utf-8" };
    const sres = await fetch(`https://api.themoviedb.org/3/search/${kind}?query=${encodeURIComponent(title)}` + (kind === "movie" && year ? `&year=${year}` : "") + "&include_adult=false", { headers });
    const sj = await sres.json();
    const first = (sj.results || [])[0];
    if (!first) return { results: [] };
    const rres = await fetch(`https://api.themoviedb.org/3/${kind}/${first.id}/recommendations?page=1`, { headers });
    const rj = await rres.json();
    const results = (rj.results || []).slice(0, 8).map((x) => {
      const isTv = kind === "tv";
      const date = (isTv ? x.first_air_date : x.release_date) || "";
      return { title: isTv ? (x.name || "") : (x.title || ""), year: date ? Number(date.slice(0, 4)) : null, type: isTv ? "series" : "movie", poster: x.poster_path ? `https://image.tmdb.org/t/p/w92${x.poster_path}` : null, overview: x.overview || "" };
    }).filter((x) => x.title);
    return { results };
  },
);

// ---- Screening Room: TMDB trailer (YouTube key) ----
exports.getTrailer = onCall(
  { secrets: [TMDB_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { allowed } = await waRoles(email);
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");
    const rawTitle = String((request.data && request.data.title) || "").trim();
    const year = String((request.data && request.data.year) || "").trim();
    const kind = String((request.data && request.data.type) || "movie") === "series" ? "tv" : "movie";
    if (!rawTitle) throw new HttpsError("invalid-argument", "Title required.");
    const title = rawTitle.replace(/\s*\((series|trilogy)\)\s*$/i, "").trim();
    const headers = { Authorization: `Bearer ${TMDB_KEY.value()}`, "Content-Type": "application/json;charset=utf-8" };
    const sres = await fetch(`https://api.themoviedb.org/3/search/${kind}?query=${encodeURIComponent(title)}` + (kind === "movie" && year ? `&year=${year}` : "") + "&include_adult=false", { headers });
    const sj = await sres.json();
    const first = (sj.results || [])[0];
    if (!first) return { key: null };
    const vres = await fetch(`https://api.themoviedb.org/3/${kind}/${first.id}/videos`, { headers });
    const vj = await vres.json();
    const vids = (vj.results || []).filter((v) => v.site === "YouTube");
    const pick = vids.find((v) => v.type === "Trailer" && v.official) || vids.find((v) => v.type === "Trailer") || vids.find((v) => v.type === "Teaser") || vids[0];
    return pick ? { key: pick.key, name: pick.name || "Trailer" } : { key: null };
  },
);

// ---- Listening Room: iTunes Search (free, no auth) for music discovery ----
exports.musicSearch = onCall(
  { region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { allowed } = await waRoles(email);
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");
    const q = String((request.data && request.data.query) || "").trim();
    const entity = String((request.data && request.data.entity) || "musicArtist"); // musicArtist | song | album
    if (q.length < 2) return { results: [] };
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=${encodeURIComponent(entity)}&limit=12&country=ZA`;
    const r = await fetch(url);
    const j = await r.json();
    const results = (j.results || []).map((x) => ({
      kind: x.wrapperType === "artist" ? "artist" : (x.kind || x.wrapperType || "song"),
      name: x.artistName || "",
      title: x.trackName || x.collectionName || x.artistName || "",
      artwork: (x.artworkUrl100 || "").replace("100x100", "200x200") || null,
      genre: x.primaryGenreName || "",
      preview: x.previewUrl || null,
      itunesUrl: x.trackViewUrl || x.collectionViewUrl || x.artistLinkUrl || null,
    })).filter((x) => x.title);
    return { results };
  },
);

// ---- Listening Room: Gemini discernment for a Christian-music item ----
exports.analyzeMusic = onCall(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { admin } = await waRoles(email);
    if (!admin) throw new HttpsError("permission-denied", "Admins only.");
    const name = String((request.data && request.data.name) || "").trim(); // artist or "Song — Artist"
    const cat = String((request.data && request.data.category) || "").trim();
    if (!name) throw new HttpsError("invalid-argument", "Name required.");
    const prompt = `You are screening music for a Reformed Christian family (biblical-creationist worldview; parents + boys 8 and 11) who want worship AND everyday music by Christian artists. Assess: "${name}"${cat ? " (" + cat + ")" : ""}. Judge the artist/song's lyrical content and worldview. Return STRICT JSON only:
{"rating":"green|amber|red","category":"Worship|CCM/Pop|Hip-Hop|Hymn|Kids|Gospel|Crossover","suits":"all|boys|alone","languageFlag":"clean|filter","summary":"<one sentence>","analysis":{"tone":"<mood in a few words>","spiritual":"<gospel-centred? worship? evangelistic? everyday?>","theology":"<for a Reformed family: doctrinally rich / thin / concerning, or 'n/a'>","occult":"<any occult/dark-spiritual lyrical content, or 'None.'>","sex":"<sexual content in lyrics, or 'None.'>","language":"<profanity/blasphemy, or 'None.'>","themes":"<main lyrical themes>"}}
Rules: green=clearly Christian & clean; amber=believer/crossover artist but some tracks need discernment, or theologically thin/prosperity-leaning worship; red=explicit content, occult/dark themes, or not actually Christian. languageFlag "filter" if ANY profanity/blasphemy.`;
    const schema = { type: "object", properties: { rating: { type: "string", enum: ["green", "amber", "red"] }, category: { type: "string" }, suits: { type: "string", enum: ["all", "boys", "alone"] }, languageFlag: { type: "string", enum: ["clean", "filter"] }, summary: { type: "string" }, analysis: { type: "object", properties: { tone: { type: "string" }, spiritual: { type: "string" }, theology: { type: "string" }, occult: { type: "string" }, sex: { type: "string" }, language: { type: "string" }, themes: { type: "string" } }, required: ["tone", "spiritual", "theology", "occult", "sex", "language", "themes"] } }, required: ["rating", "category", "suits", "languageFlag", "summary", "analysis"] };
    const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", response_schema: schema, temperature: 0.3 } });
    let data = null, lastErr = "";
    for (const model of models) {
      for (let a = 0; a < 3 && !data; a++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        const jr = await r.json();
        if (r.ok) { data = jr; break; }
        lastErr = (jr && jr.error && jr.error.message) || `gemini ${r.status}`;
        if (r.status === 503 || r.status === 429) { await sleep(700 * (a + 1)); continue; }
        break;
      }
      if (data) break;
    }
    if (!data) throw new HttpsError("unavailable", "The AI is busy (" + lastErr + "). Try again shortly.");
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || "{}";
    try { return JSON.parse(text); } catch { throw new HttpsError("internal", "Could not parse the AI response."); }
  },
);

// ---- Listening Room: resolve a track to a direct Tidal link ----
// Client-credentials OAuth (secret stays server-side); returns the canonical
// tidal.com/browse/track/<id> share link for the best catalogue match.
let _tidalTok = { value: null, exp: 0 };
async function tidalToken() {
  const now = Date.now();
  if (_tidalTok.value && now < _tidalTok.exp) return _tidalTok.value;
  const basic = Buffer.from(`${TIDAL_CLIENT_ID.value()}:${TIDAL_CLIENT_SECRET.value()}`).toString("base64");
  const r = await fetch("https://auth.tidal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!j.access_token) return null;
  _tidalTok = { value: j.access_token, exp: now + Math.max(60, (j.expires_in || 3600) - 60) * 1000 };
  return _tidalTok.value;
}
exports.tidalLookup = onCall(
  { secrets: [TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { allowed } = await waRoles(email);
    if (!allowed) throw new HttpsError("permission-denied", "Not allowed.");
    const title = String((request.data && request.data.title) || "").trim();
    const artist = String((request.data && request.data.artist) || "").trim();
    if (!title && !artist) return { url: null };
    const token = await tidalToken();
    if (!token) return { url: null };
    try {
      const q = encodeURIComponent(`${title} ${artist}`.trim());
      const r = await fetch(`https://openapi.tidal.com/v2/searchResults/${q}?countryCode=ZA&include=tracks`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
      });
      if (!r.ok) return { url: null };
      const j = await r.json();
      const order = (((j.data || {}).relationships || {}).tracks || {}).data || [];
      const tracks = (j.included || []).filter((x) => x.type === "tracks");
      const byId = {}; tracks.forEach((t) => { byId[t.id] = t; });
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const want = norm(title);
      const pick = order.map((x) => byId[x.id]).find((t) => t && norm(t.attributes && t.attributes.title) === want)
        || order.map((x) => byId[x.id]).find((t) => t && norm(t.attributes && t.attributes.title).includes(want))
        || byId[(order[0] || {}).id];
      if (!pick) return { url: null };
      const link = (pick.attributes && (pick.attributes.externalLinks || []).find((l) => l.href));
      return { url: link ? link.href : `https://tidal.com/browse/track/${pick.id}` };
    } catch (e) { return { url: null }; }
  },
);

// ---- Listening Room: Tidal user-login (authorization code) flow ----
// Exchanges the auth code (with the client secret, server-side) for a user token,
// then lists the signed-in user's own playlists.
const TIDAL_H = (token) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" });
exports.tidalExchange = onCall(
  { secrets: [TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { admin } = await waRoles(email);
    if (!admin) throw new HttpsError("permission-denied", "Admins only.");
    const code = String((request.data && request.data.code) || "");
    const verifier = String((request.data && request.data.codeVerifier) || "");
    const redirectUri = String((request.data && request.data.redirectUri) || "");
    if (!code || !redirectUri) throw new HttpsError("invalid-argument", "Missing code/redirectUri.");
    const basic = Buffer.from(`${TIDAL_CLIENT_ID.value()}:${TIDAL_CLIENT_SECRET.value()}`).toString("base64");
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri,
      client_id: TIDAL_CLIENT_ID.value() });
    if (verifier) body.set("code_verifier", verifier);
    const tr = await fetch("https://auth.tidal.com/v1/oauth2/token", { method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const tj = await tr.json();
    if (!tr.ok || !tj.access_token) throw new HttpsError("unavailable", "Token exchange failed: " + (tj.error_description || tj.error || tr.status));
    const token = tj.access_token;
    // Who am I?
    let userId = tj.user_id || (tj.user && tj.user.userId) || null;
    if (!userId) { try { const me = await (await fetch("https://openapi.tidal.com/v2/users/me?countryCode=ZA", { headers: TIDAL_H(token) })).json(); userId = me && me.data && me.data.id; } catch (e) {} }
    // List the user's playlists.
    const playlists = [];
    let next = userId ? `/userCollections/${userId}/relationships/playlists?countryCode=ZA&include=playlists&page[limit]=50` : null;
    let guard = 0;
    try {
      while (next && guard++ < 20) {
        const r = await fetch("https://openapi.tidal.com/v2" + next, { headers: TIDAL_H(token) });
        if (!r.ok) { if (playlists.length) break; throw new HttpsError("unavailable", "Couldn't list playlists (HTTP " + r.status + "). Endpoint may differ for your account."); }
        const j = await r.json();
        (j.included || []).filter((x) => x.type === "playlists").forEach((p) => playlists.push({ id: p.id, name: (p.attributes && p.attributes.name) || "Untitled", count: (p.attributes && p.attributes.numberOfItems) || 0 }));
        next = (j.links && j.links.next) || null;
      }
    } catch (e) { if (e instanceof HttpsError) throw e; }
    return { accessToken: token, userId: userId || null, playlists };
  },
);
exports.tidalUserItems = onCall(
  { region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    const { admin } = await waRoles(email);
    if (!admin) throw new HttpsError("permission-denied", "Admins only.");
    const token = String((request.data && request.data.accessToken) || "");
    const playlistId = String((request.data && request.data.playlistId) || "");
    if (!token || !playlistId) throw new HttpsError("invalid-argument", "Missing accessToken/playlistId.");
    const tracks = [];
    let next = `/playlists/${playlistId}/relationships/items?countryCode=ZA&include=items.artists&page[limit]=50`, guard = 0;
    while (next && guard++ < 40) {
      const r = await fetch("https://openapi.tidal.com/v2" + next, { headers: TIDAL_H(token) });
      if (!r.ok) break;
      const j = await r.json();
      const artists = {}; (j.included || []).filter((x) => x.type === "artists").forEach((a) => { artists[a.id] = a.attributes && a.attributes.name; });
      (j.included || []).filter((x) => x.type === "tracks").forEach((t) => {
        const at = t.attributes || {};
        const aids = ((t.relationships && t.relationships.artists && t.relationships.artists.data) || []).map((a) => artists[a.id]).filter(Boolean);
        const link = (at.externalLinks || []).find((l) => l.href);
        tracks.push({ title: at.title, artist: aids.join(", "), explicit: !!at.explicit, tidalUrl: link ? link.href : null });
      });
      next = (j.links && j.links.next) || null;
    }
    return { tracks };
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

// ---- Home watchdog -------------------------------------------------------
// Scheduled sweep of Home Assistant that pushes a notification the moment an
// actionable problem appears — the proactive counterpart to the in-app "Needs
// attention" card. It de-dupes via Firestore `watchdogState/{key}` so each
// incident alerts once (on appearance), not every run; it re-arms when the
// condition clears, so the next occurrence alerts again.

// Fan a notification out to every registered device (shared with sendPush).
async function pushToAll(title, body, tag) {
  const snap = await db.collection("pushTokens").get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return { sent: 0, note: "no devices" };
  const resp = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { notification: { icon: "/favicon.svg", tag }, fcmOptions: { link: "/" } },
    data: tag ? { tag } : {},
  });
  const dead = [];
  resp.responses.forEach((r, i) => {
    if (!r.success && ["messaging/registration-token-not-registered", "messaging/invalid-argument"].includes(r.error && r.error.code)) dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.collection("pushTokens").doc(t).delete()));
  return { sent: resp.successCount, failed: resp.failureCount, pruned: dead.length };
}

// Evaluate the ruleset against a fetched HA state map. Returns the list of
// currently-firing incidents: { key, title, body }.
function evalWatchdog(states) {
  const m = Object.fromEntries(states.map((e) => [e.entity_id, e]));
  const st = (id) => m[id] && m[id].state;
  const num = (id) => { const v = parseFloat(m[id] && m[id].state); return Number.isFinite(v) ? v : null; };
  const on = (id) => st(id) === "on";
  const armed = (st("alarm_control_panel.olarm_alarm") || "").startsWith("armed");
  // SAST = UTC+2 (no DST).
  const hour = (new Date().getUTCHours() + 2) % 24;
  const night = hour >= 21 || hour < 6;

  const out = [];
  const soc = num("sensor.victron_battery_soc");
  if (soc != null && soc < 15) out.push({ key: "batt-crit", title: "🔋 Battery critically low", body: `Battery bank at ${Math.round(soc)}% — shed heavy loads.` });
  else if (soc != null && soc < 30) out.push({ key: "batt-low", title: "🔋 Battery low", body: `Battery bank at ${Math.round(soc)}% — watch heavy appliances.` });

  if (st("binary_sensor.helloliam_alarm_ac_power") === "off")
    out.push({ key: "alarm-ac", title: "🔌 Alarm on backup power", body: "Mains lost to the alarm panel." });

  const nobodyHome = on("binary_sensor.nobody_home") || st("sensor.home_occupancy") === "Empty";
  if (nobodyHome && !armed && st("alarm_control_panel.olarm_alarm") !== "triggered")
    out.push({ key: "alarm-empty", title: "🛡️ Alarm is off", body: "Nobody home and the alarm isn't armed." });

  const doors = [
    ["binary_sensor.helloliam_alarm_zone_013_front_door", "Front door"],
    ["binary_sensor.helloliam_alarm_zone_020_door_kitchen", "Kitchen door"],
    ["binary_sensor.helloliam_alarm_zone_024_door_lounge", "Lounge door"],
  ].filter(([id]) => on(id)).map(([, label]) => label);
  if (doors.length && (night || nobodyHome))
    out.push({ key: "doors-open", title: "🚪 Door open", body: `${doors.join(", ")} open${night ? " after dark" : " while out"}.` });

  if (on("binary_sensor.jojo_tank_monitor_tank_low_water_alert"))
    out.push({ key: "tank-low", title: "💧 Water tank low", body: "The JoJo tank hit its low-water mark." });

  if (on("binary_sensor.frigate_detection_stalled"))
    out.push({ key: "frigate", title: "📷 Camera detection stalled", body: "Frigate has stopped processing detections." });

  const sysIssues = num("sensor.system_health_issues");
  if (sysIssues != null && sysIssues > 0)
    out.push({ key: "sys", title: "🩺 System health", body: `${sysIssues} system health issue(s) need a look.` });

  // Zigbee mesh health — ZHA per-device link quality (LQI 0–255) + reachability.
  const zname = (e) => (e.attributes && e.attributes.friendly_name || e.entity_id).replace(/ ?(LQI|Lqi|lqi)$/, "").trim();
  const lqiEnts = states.filter((e) => /_lqi$/.test(e.entity_id));
  const weakZ = lqiEnts.filter((e) => { const v = parseFloat(e.state); return Number.isFinite(v) && v > 0 && v < 20; }).map(zname);
  const offlineZ = lqiEnts.filter((e) => e.state === "unavailable").map(zname);
  if (offlineZ.length)
    out.push({ key: "zigbee-offline", title: "📡 Zigbee device offline", body: `Not responding: ${offlineZ.join(", ")}` });
  if (weakZ.length)
    out.push({ key: "zigbee-weak", title: "📡 Weak Zigbee link", body: `${weakZ.length} device(s) on a failing link (LQI < 20): ${weakZ.join(", ")}` });

  return out;
}

async function runWatchdog() {
  const base = HA_URL.value().replace(/\/+$/, "");
  const r = await fetch(`${base}/api/states`, { headers: { Authorization: `Bearer ${HA_TOKEN.value()}` } });
  if (!r.ok) throw new Error(`HA ${r.status}`);
  const states = await r.json();
  const firing = evalWatchdog(states);
  const firingKeys = new Set(firing.map((f) => f.key));

  // Load prior active state.
  const prior = await db.collection("watchdogState").get();
  const wasActive = new Set(prior.docs.filter((d) => d.data().active).map((d) => d.id));

  let pushed = 0;
  for (const f of firing) {
    if (!wasActive.has(f.key)) {
      await pushToAll(f.title, f.body, f.key);
      pushed++;
    }
    await db.collection("watchdogState").doc(f.key).set({ active: true, title: f.title, ts: Date.now() });
  }
  // Re-arm any rule that has cleared.
  const cleared = [];
  for (const key of wasActive) {
    if (!firingKeys.has(key)) { await db.collection("watchdogState").doc(key).set({ active: false, ts: Date.now() }, { merge: true }); cleared.push(key); }
  }
  logger.info("watchdog", { firing: [...firingKeys], pushed, cleared });
  return { firing: [...firingKeys], pushed, cleared };
}

exports.homeWatchdog = onSchedule(
  { schedule: "every 30 minutes", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await runWatchdog(); },
);

exports.homeWatchdogNow = onRequest(
  { secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    try { const r = await runWatchdog(); res.status(200).json({ ok: true, ...r }); }
    catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  },
);

// ---- Proactive anomaly nudges --------------------------------------------
// The watchdog above catches things we could think of in advance (thresholds we
// hard-coded). This catches the ones we didn't: it hands Gemini a snapshot of
// the house *in context* — time of day, who's home, what's armed, what's been
// left running — and asks "is anything here worth interrupting a person about?"
// That's the Alexa+ "your garage is unlocked and it's after 10pm" pattern.
//
// Alert fatigue is the failure mode that kills features like this, so the
// design copies Alexa Hunches' two-stage split: the model PREDICTS, then a
// separate deterministic gate decides whether it's allowed to SURFACE.
// Gate rules: max 1 nudge per run, 6h cooldown per key, 3/day cap, quiet hours
// 21:30–06:00 (unless the model marks it urgent), and anything the plain
// watchdog already alerts on is suppressed as a duplicate.

const NUDGE_DAILY_CAP = 3;
const NUDGE_COOLDOWN_MS = 6 * 3600_000;

// Condense ~5000 entities into the handful of facts that actually carry meaning
// for "is something off?". Keeping this tight matters: a smaller, cleaner
// context gives far better judgement than dumping the whole state machine.
function homeContext(states) {
  const m = Object.fromEntries(states.map((e) => [e.entity_id, e]));
  const st = (id) => m[id] && m[id].state;
  const num = (id) => { const v = parseFloat(m[id] && m[id].state); return Number.isFinite(v) ? v : null; };
  const on = (id) => st(id) === "on";
  const fname = (e) => (e.attributes && e.attributes.friendly_name) || e.entity_id;
  // Minutes since an entity last changed — "how long has it been like this".
  const mins = (id) => {
    const lc = m[id] && m[id].last_changed;
    if (!lc) return null;
    const d = (Date.now() - Date.parse(lc)) / 60000;
    return Number.isFinite(d) ? Math.round(d) : null;
  };

  const sast = new Date(Date.now() + 2 * 3600_000);
  const hour = sast.getUTCHours();
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][sast.getUTCDay()];

  const lightsOn = states
    .filter((e) => /^(light|switch)\./.test(e.entity_id) && e.state === "on" && /light|lamp|spot/i.test(fname(e)))
    .map((e) => ({ name: fname(e), onFor: mins(e.entity_id) }));

  const openings = [
    ["binary_sensor.helloliam_alarm_zone_013_front_door", "Front door"],
    ["binary_sensor.helloliam_alarm_zone_020_door_kitchen", "Kitchen door"],
    ["binary_sensor.helloliam_alarm_zone_024_door_lounge", "Lounge door"],
    ["binary_sensor.helloliam_alarm_zone_030_beam_garage", "Garage"],
  ].filter(([id]) => on(id)).map(([id, label]) => ({ name: label, openFor: mins(id) }));

  // Power matters more than switch state here. Several of these are always-on
  // plugs or pressure-driven pumps that sit energised and idle — the water pump
  // reads "on" for 12h while drawing 3W. Reporting the switch alone made the
  // model cry leak; reporting watts lets it tell "running" from "merely on".
  const POWER_OF = {
    "switch.pool_pump": "sensor.pool_pump_power_now",
    "switch.borehole_pump": "sensor.borehole_pump_power_now",
    "switch.water_pump": "sensor.water_pump_power",
    "switch.kettle": "sensor.kettle_current_consumption",
    "switch.study_heater": "sensor.study_heater_current_consumption",
    "switch.tumble_dryer": "sensor.tumble_dryer_energy_power",
    "switch.washing_machine": "sensor.washing_machine_energy_power",
    "switch.top_loader": "sensor.top_loader_current_consumption",
    "switch.dishwasher": "sensor.dishwasher_current_consumption",
    "switch.air_fryer": "sensor.air_fryer_current_consumption",
    "switch.microwave": "sensor.microwave_current_consumption",
    "switch.nespresso": "sensor.nespresso_current_consumption",
    "switch.work_pc": "sensor.work_pc_current_consumption",
  };
  // Above this many watts the device is genuinely doing work, not idling.
  const RUNNING_W = { "switch.water_pump": 20, "switch.borehole_pump": 40, "switch.pool_pump": 40 };
  const describe = (id) => {
    const w = POWER_OF[id] ? num(POWER_OF[id]) : null;
    const floor = RUNNING_W[id] ?? 5;
    return {
      name: fname(m[id]),
      switchOnFor: mins(id),
      watts: w,
      actuallyRunning: w == null ? null : w > floor,
    };
  };

  const appliances = states
    .filter((e) => /^switch\./.test(e.entity_id) && e.state === "on" && /kettle|heater|dryer|washing|dishwasher|air_fryer|microwave|nespresso|top_loader|iron|pc/i.test(e.entity_id))
    .map((e) => describe(e.entity_id));

  const pumps = ["switch.pool_pump", "switch.borehole_pump", "switch.water_pump"]
    .filter((id) => on(id))
    .map(describe);

  return {
    time: `${String(hour).padStart(2, "0")}:${String(sast.getUTCMinutes()).padStart(2, "0")} SAST`,
    dayOfWeek: dow,
    partOfDay: hour < 6 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "late evening",
    alarm: st("alarm_control_panel.olarm_alarm") || "unknown",
    occupancy: st("sensor.home_occupancy") || "unknown",
    nobodyHome: on("binary_sensor.nobody_home"),
    batterySoc: num("sensor.victron_battery_soc"),
    solarNowW: num("sensor.victron_total_pv_power"),
    gridStatus: st("sensor.victron_grid_lost_alarm") || "unknown",
    loadshedding: st("sensor.loadshedding") || "unknown",
    tankLevelPct: num("sensor.jojo_tank_monitor_tank_water_level"),
    indoorTempC: num("sensor.indoor_average_temperature"),
    outdoorTempC: num("sensor.outdoor_temperature"),
    weather: st("weather.home") || "unknown",
    lightsOn,
    openings,
    appliancesOn: appliances,
    pumpsRunning: pumps,
  };
}

const NUDGE_SCHEMA = {
  type: "object",
  properties: {
    nudges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "short stable slug, e.g. garage-open-late" },
          title: { type: "string", description: "max 6 words, may start with one emoji" },
          body: { type: "string", description: "one plain sentence naming the observation and why it matters now" },
          confidence: { type: "number", description: "0-1, how sure you are this is genuinely worth interrupting a person" },
          urgent: { type: "boolean", description: "true only if it should break quiet hours (safety/security/damage)" },
          view: { type: "string", description: "portal view to open: home, security, energy, lights, water, appliances, cameras, climate" },
        },
        required: ["key", "title", "body", "confidence", "urgent", "view"],
      },
    },
  },
  required: ["nudges"],
};

async function askGeminiForNudges(ctx) {
  const prompt = `You are the watchful assistant for a family home in Pretoria, South Africa (solar + battery, load-shedding is normal, family of four with two young boys).

Here is the CURRENT state of the house:
${JSON.stringify(ctx, null, 1)}

Identify anything genuinely ANOMALOUS or worth a gentle heads-up RIGHT NOW, given the time of day, who is home, and how long things have been in their current state.

Good nudges look like: "the garage has been open 40 minutes and everyone's out", "the heater's been on 6 hours in an empty house", "the pool pump has run 11 hours today", "tank is low and no rain forecast".

CRITICAL — "switched on" is NOT "running". Several plugs and pumps sit energised
and idle all day. For anything with a \`watts\` field, judge by \`actuallyRunning\`
and \`watts\`, NEVER by \`switchOnFor\` alone:
- The water pump is pressure-driven: it normally reads on 24/7 at ~3W and only
  draws real power on demand. \`actuallyRunning: false\` means it is IDLE and fine.
- The kettle, air fryer and similar are on smart plugs left switched on at 0W.
- Only flag one of these if \`actuallyRunning\` is true AND it has been so for an
  unreasonable length of time.

Rules:
- Only report things a reasonable person would WANT to be interrupted about. Silence is the correct answer most of the time — return an empty array if nothing stands out.
- Do NOT report: normal daytime lighting, solar/battery behaviour that is expected, pumps that have run a normal amount, anything that is obviously routine for the time of day.
- Do NOT report a device as "left on" or "running long" when \`actuallyRunning\` is false or \`watts\` is near zero.
- Do NOT invent state that isn't in the data. Never guess.
- Be specific and quantitative — name the thing and how long.
- confidence: below 0.7 means you're speculating; be honest.
- urgent: reserve for safety, security or property damage.
- Maximum 3 nudges. Prefer 0 or 1.`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: NUDGE_SCHEMA },
  });
  const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  let lastErr = "no model";
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      const j = await r.json();
      if (r.ok) {
        const txt = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(txt || "{}");
        return Array.isArray(parsed.nudges) ? parsed.nudges : [];
      }
      lastErr = (j && j.error && j.error.message) || `gemini ${r.status}`;
    } catch (e) { lastErr = String((e && e.message) || e); }
  }
  logger.warn("nudge gemini failed", { lastErr });
  return [];
}

async function runNudgeScan({ dryRun = false } = {}) {
  const base = HA_URL.value().replace(/\/+$/, "");
  const r = await fetch(`${base}/api/states`, { headers: { Authorization: `Bearer ${HA_TOKEN.value()}` } });
  if (!r.ok) throw new Error(`HA ${r.status}`);
  const states = await r.json();

  const ctx = homeContext(states);
  const candidates = await askGeminiForNudges(ctx);

  // ---- Stage 2: the surfacing gate (deterministic, not the model's call) ----
  const sast = new Date(Date.now() + 2 * 3600_000);
  const minsOfDay = sast.getUTCHours() * 60 + sast.getUTCMinutes();
  const quietHours = minsOfDay >= 21 * 60 + 30 || minsOfDay < 6 * 60;

  // Don't duplicate anything the deterministic watchdog is already shouting about.
  const wdSnap = await db.collection("watchdogState").where("active", "==", true).get();
  const watchdogActive = wdSnap.docs.length > 0;

  const since = Date.now() - 86_400_000;
  const todaySnap = await db.collection("nudges").where("ts", ">=", since).get();
  const sentToday = todaySnap.docs.length;
  const recentByKey = new Map(todaySnap.docs.map((d) => [d.data().key, d.data().ts]));

  const rejected = [];
  const eligible = [];
  for (const nd of candidates) {
    if (!nd || !nd.key || !nd.title || !nd.body) { rejected.push({ key: nd && nd.key, why: "malformed" }); continue; }
    if (typeof nd.confidence !== "number" || nd.confidence < 0.7) { rejected.push({ key: nd.key, why: `low confidence ${nd.confidence}` }); continue; }
    const last = recentByKey.get(nd.key);
    if (last && Date.now() - last < NUDGE_COOLDOWN_MS) { rejected.push({ key: nd.key, why: "cooldown" }); continue; }
    if (quietHours && !nd.urgent) { rejected.push({ key: nd.key, why: "quiet hours" }); continue; }
    eligible.push(nd);
  }

  // Highest confidence first; urgent always outranks non-urgent.
  eligible.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || b.confidence - a.confidence);

  let pushed = 0;
  const surfaced = [];
  for (const nd of eligible) {
    if (sentToday + pushed >= NUDGE_DAILY_CAP) { rejected.push({ key: nd.key, why: "daily cap" }); continue; }
    if (pushed >= 1) { rejected.push({ key: nd.key, why: "one per run" }); continue; }
    if (watchdogActive && !nd.urgent) { rejected.push({ key: nd.key, why: "watchdog already alerting" }); continue; }
    if (!dryRun) {
      await db.collection("nudges").add({
        key: nd.key, title: nd.title, body: nd.body, view: nd.view || "home",
        confidence: nd.confidence, urgent: !!nd.urgent,
        ts: Date.now(), dismissed: false,
      });
      await pushToAll(nd.title, nd.body, `nudge-${nd.key}`);
    }
    surfaced.push(nd);
    pushed++;
  }

  logger.info("nudgeScan", { candidates: candidates.length, surfaced: surfaced.map((n) => n.key), rejected, quietHours, sentToday });
  return { context: ctx, candidates, surfaced, rejected, quietHours, sentToday, dryRun };
}

exports.anomalyNudges = onSchedule(
  { schedule: "every 2 hours", secrets: [HA_URL, HA_TOKEN, GEMINI_API_KEY], region: "us-central1", maxInstances: 1 },
  async () => { await runNudgeScan(); },
);

// Manual trigger — `?dry=1` evaluates and reports without pushing or storing,
// which is how you tune the prompt without spamming the family's phones.
exports.anomalyNudgesNow = onRequest(
  { secrets: [HA_URL, HA_TOKEN, GEMINI_API_KEY], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    try {
      const out = await runNudgeScan({ dryRun: req.query.dry === "1" });
      res.status(200).json({ ok: true, ...out });
    } catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  },
);

// ---- Daily briefings ------------------------------------------------------
// A morning ("today at a glance") and evening ("wind-down") digest composed
// from Home Assistant + the reminders calendar, delivered as an FCM push at
// 06:30 / 20:30 SAST and shown live in the Overview "briefing" card.

const WX_EMOJI = { sunny: "☀️", "clear-night": "🌙", clear: "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "⛈️", lightning: "⚡", "lightning-rainy": "⛈️", fog: "🌫️", windy: "💨", hail: "🌨️", snowy: "❄️" };

// SAST wall-clock via UTC getters on a +2h-shifted Date.
const sastDate = () => new Date(Date.now() + 2 * 3600_000);
function fmtSastTime(iso) {
  try {
    const s = new Date(new Date(iso).getTime() + 2 * 3600_000);
    let h = s.getUTCHours(); const mm = s.getUTCMinutes();
    const ap = h < 12 ? "am" : "pm"; h = h % 12 || 12;
    return `${h}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`;
  } catch { return ""; }
}

async function haCalendarDay(base, tok, cal, dayOffset) {
  const s = sastDate();
  const startUTC = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + dayOffset, 0, 0, 0) - 2 * 3600_000);
  const endUTC = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + dayOffset, 23, 59, 59) - 2 * 3600_000);
  try {
    const r = await fetch(`${base}/api/calendars/${cal}?start=${startUTC.toISOString()}&end=${endUTC.toISOString()}`, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) return [];
    const ev = await r.json();
    return (ev || []).map((e) => ({ summary: e.summary || "(busy)", start: (e.start && (e.start.dateTime || e.start.date)) || null, allDay: !(e.start && e.start.dateTime) }))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  } catch { return []; }
}

async function composeBriefing(period) {
  const base = HA_URL.value().replace(/\/+$/, ""); const tok = HA_TOKEN.value();
  const r = await fetch(`${base}/api/states`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`HA ${r.status}`);
  const states = await r.json();
  const m = Object.fromEntries(states.map((e) => [e.entity_id, e]));
  const st = (id) => m[id] && m[id].state;
  const num = (id) => { const v = parseFloat(m[id] && m[id].state); return Number.isFinite(v) ? v : null; };
  const on = (id) => st(id) === "on";

  const lines = [];
  const wx = WX_EMOJI[st("weather.home")] || "🌡️";
  const outdoor = num("sensor.outdoor_temperature");
  const loadshed = st("sensor.loadshedding");
  const lsActive = on("binary_sensor.national_loadshedding_active");
  const soc = num("sensor.victron_battery_soc");

  if (period === "morning") {
    const events = await haCalendarDay(base, tok, "calendar.reminders", 0);
    const readiness = num("sensor.oura_readiness_score");
    const sleep = num("sensor.oura_sleep_score");
    const solarFc = num("sensor.solcast_forecast_today") ?? num("sensor.energy_production_today");
    if (outdoor != null) lines.push({ icon: wx, text: `${outdoor.toFixed(0)}° out now${(st("weather.home") || "").includes("rain") ? " · rain about" : ""}` });
    if (readiness != null) lines.push({ icon: "💍", text: `Readiness ${readiness.toFixed(0)}${sleep != null ? ` · slept ${sleep.toFixed(0)}` : ""}` });
    if (events.length) {
      const first = events.find((e) => !e.allDay) || events[0];
      lines.push({ icon: "📅", text: `${events.length} today · first ${first.allDay ? first.summary : fmtSastTime(first.start) + " " + first.summary}` });
    } else lines.push({ icon: "📅", text: "Nothing on the calendar today" });
    if (lsActive) lines.push({ icon: "⚡", text: `Loadshedding — ${loadshed}` });
    else if (loadshed) lines.push({ icon: "🔌", text: `${loadshed}` });
    if (solarFc != null) lines.push({ icon: "☀️", text: `${solarFc.toFixed(0)} kWh solar expected` });
    if (soc != null) lines.push({ icon: "🔋", text: `Battery ${soc.toFixed(0)}%` });
    const summary = lines.slice(0, 3).map((l) => l.text).join(" · ");
    return { period, title: "Good morning, Christo", lines, summary, speech: `Good morning. ${lines.map((l) => l.text).join(". ")}.` };
  }

  // evening
  const tomorrow = await haCalendarDay(base, tok, "calendar.reminders", 1);
  const litSwitches = states.filter((e) => (e.entity_id.startsWith("light.") || (e.entity_id.startsWith("switch.") && /light|lamp/.test(e.entity_id))) && e.state === "on").length;
  const armed = (st("alarm_control_panel.olarm_alarm") || "").startsWith("armed");
  const tankDays = num("sensor.jojo_tank_days_remaining");
  if (tomorrow.length) {
    const first = tomorrow.find((e) => !e.allDay) || tomorrow[0];
    lines.push({ icon: "📅", text: `Tomorrow: ${tomorrow.length} on · first ${first.allDay ? first.summary : fmtSastTime(first.start) + " " + first.summary}` });
  } else lines.push({ icon: "📅", text: "Tomorrow's calendar is clear" });
  lines.push({ icon: "💡", text: `${litSwitches} light${litSwitches === 1 ? "" : "s"} still on` });
  lines.push({ icon: "🛡️", text: armed ? "Alarm is armed" : "Alarm is off — arm before bed?" });
  if (soc != null) lines.push({ icon: "🔋", text: `Battery reserve ${soc.toFixed(0)}%${lsActive ? " · loadshedding now" : ""}` });
  if (tankDays != null && tankDays < 5) lines.push({ icon: "💧", text: `Water tank ~${tankDays.toFixed(1)} days` });
  const summary = lines.slice(0, 3).map((l) => l.text).join(" · ");
  return { period, title: "Winding down", lines, summary, speech: `Good evening. ${lines.map((l) => l.text).join(". ")}.` };
}

// Live briefing for the Overview card (authed). ?period=morning|evening, else auto.
exports.getBriefing = onRequest(
  { secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 3 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    const q = String((req.query && req.query.period) || "");
    const period = q === "morning" || q === "evening" ? q : (sastDate().getUTCHours() < 15 ? "morning" : "evening");
    try { const b = await composeBriefing(period); res.status(200).json({ ok: true, ...b }); }
    catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  },
);

async function pushBriefing(period) {
  const b = await composeBriefing(period);
  await pushToAll(b.title, b.summary, `briefing-${period}`);
  return b;
}

exports.morningBriefing = onSchedule(
  { schedule: "30 6 * * *", timeZone: "Africa/Johannesburg", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await pushBriefing("morning"); },
);
exports.eveningBriefing = onSchedule(
  { schedule: "30 20 * * *", timeZone: "Africa/Johannesburg", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await pushBriefing("evening"); },
);

// ---- Kids' allowance payout → Steyn Finance -------------------------------
// The portal already recorded the payout + reset the balance client-side; this
// posts the amount into the finance project so it lands as income there. Writing
// cross-project needs the function's service account to have roles/datastore.user
// on steyn-family-finance — if it's missing this returns posted:false (the
// portal-side payout still stands), so it degrades gracefully.
exports.kidPayout = onRequest(
  { region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    let email;
    try { email = (await admin.auth().verifyIdToken(idToken)).email || null; }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    const { slug, amount } = { ...req.query, ...(req.body || {}) };
    const amt = Number(amount);
    if (!slug || !(amt > 0)) { res.status(400).json({ ok: false, error: "slug + positive amount required" }); return; }
    try {
      const fin = new Firestore({ projectId: HQ_PROJECT });
      await fin.collection("portal_allowance_payouts").add({
        slug, amount: amt, by: email, ts: Date.now(), source: "ha-portal",
      });
      res.status(200).json({ ok: true, posted: true });
    } catch (e) {
      logger.warn("kidPayout finance post failed", { error: String((e && e.message) || e) });
      res.status(200).json({ ok: true, posted: false, note: String((e && e.message) || e) });
    }
  },
);

// ---- BigQuery warehouse -----------------------------------------------------
// A nightly snapshot of the home's key metrics into BigQuery, so months/years
// of history can be queried in SQL and charted in Looker Studio — the long-term
// store InfluxDB (operational) doesn't give us for cross-source joins.
// Dataset/table are auto-created; the function's service account needs BigQuery
// access (project Editor covers it, else grant roles/bigquery.dataEditor +
// roles/bigquery.jobUser).
const BQ_DATASET = "home";
const BQ_TABLE = "daily";
// [HA entity_id, BigQuery column] — numeric daily metrics.
//
// Two rules, both learned the hard way:
//
// 1. EVERY ID HERE MUST EXIST. `num()` silently returns null for an entity that
//    isn't there, so a typo doesn't fail — it writes a NULL column for months
//    and looks like a working warehouse. Five of the original fifteen were
//    wrong (victron_battery_soc, solar_yield_today, victron_grid_import_today,
//    vehicles_today, pedestrians_today), which is a third of the table empty.
//    Verify against .storage/core.entity_registry before adding a row here.
//
// 2. ONLY CUMULATIVE-OR-DAILY SOURCES. The snapshot reads /api/states at 23:55,
//    so an instantaneous sensor lands as "its value at five to midnight" — a
//    column called battery_soc that can't answer "how low did it get". Those
//    now read the ratcheted daily extremes from feature_warehouse_daily.yaml.
const WAREHOUSE_METRICS = [
  // --- energy ---------------------------------------------------------------
  ["sensor.battery_soc_clean", "battery_soc"], // end-of-day level
  ["sensor.battery_soc_min_today", "battery_soc_min"], // the useful one
  ["sensor.battery_soc_max_today", "battery_soc_max"],
  ["sensor.victron_total_pv_yield_today", "solar_kwh"],
  ["sensor.victron_grid_import_daily", "grid_import_kwh"],
  ["sensor.grid_independence_today", "grid_independence_pct"],
  ["sensor.self_consumption", "self_consumption_pct"],
  ["sensor.energy_cost_today", "energy_cost"],
  ["sensor.house_load_min_today", "base_load_w"], // always-on floor
  ["sensor.house_load_peak_today", "peak_load_w"], // day's ceiling
  ["sensor.battery_runtime_off_grid_today", "off_grid_hours"],
  ["sensor.load_shedding_urgency", "loadshed_urgency"],
  // --- water ----------------------------------------------------------------
  ["sensor.water_used_today", "water_l"],
  ["sensor.borehole_pump_water_pumped_today", "borehole_l"],
  ["sensor.water_pump_runtime_today", "water_pump_min"],
  ["sensor.jojo_tank_monitor_tank_water_level", "tank_pct"], // end-of-day level
  ["sensor.tank_level_min_today", "tank_pct_min"],
  ["sensor.tank_level_max_today", "tank_pct_max"],
  // --- climate --------------------------------------------------------------
  ["sensor.indoor_average_temperature", "indoor_temp"], // end-of-day reading
  ["sensor.indoor_temp_min_today", "indoor_temp_min"],
  ["sensor.indoor_temp_max_today", "indoor_temp_max"],
  ["sensor.outdoor_temperature", "outdoor_temp"], // end-of-day reading
  ["sensor.outdoor_temp_min_today", "outdoor_temp_min"],
  ["sensor.outdoor_temp_max_today", "outdoor_temp_max"],
  // --- security -------------------------------------------------------------
  ["sensor.alarm_armed_hours_today", "alarm_armed_hours"],
  ["input_number.sidewalk_vehicles_total_today", "vehicles"],
  ["input_number.sidewalk_pedestrians_total_today", "pedestrians"],
  // --- health ---------------------------------------------------------------
  ["sensor.oura_readiness_score", "oura_readiness"],
  ["sensor.oura_sleep_score", "oura_sleep"],
];

async function runWarehouseSnapshot() {
  const base = HA_URL.value().replace(/\/+$/, "");
  const r = await fetch(`${base}/api/states`, { headers: { Authorization: `Bearer ${HA_TOKEN.value()}` } });
  if (!r.ok) throw new Error(`HA ${r.status}`);
  const states = await r.json();
  const m = Object.fromEntries(states.map((e) => [e.entity_id, e]));
  const num = (id) => { const v = parseFloat(m[id] && m[id].state); return Number.isFinite(v) ? v : null; };

  const s = sastDate();
  const row = { date: `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}` };
  const missing = [];
  for (const [id, col] of WAREHOUSE_METRICS) {
    row[col] = num(id);
    if (row[col] === null) missing.push(id);
  }
  // Loud, every night. A null column is indistinguishable from a healthy one in
  // BigQuery, which is exactly how five wrong entity IDs survived for months.
  if (missing.length) logger.warn("warehouseSnapshot: no value for", { missing, count: missing.length });

  const bq = new BigQuery();
  const dataset = bq.dataset(BQ_DATASET);
  const [dsExists] = await dataset.exists();
  if (!dsExists) await dataset.create();
  const table = dataset.table(BQ_TABLE);
  const [tExists] = await table.exists();
  if (!tExists) {
    const schema = [{ name: "date", type: "DATE" }, ...WAREHOUSE_METRICS.map(([, col]) => ({ name: col, type: "FLOAT" }))];
    await table.create({ schema });
  } else {
    // Additive schema migration. BigQuery rejects an insert containing a field
    // the table doesn't have, so growing WAREHOUSE_METRICS has to grow the table
    // too. Adding NULLABLE columns is free and non-destructive — existing rows
    // read as null for the new columns, which is the truth: we weren't
    // measuring them yet. Nothing is ever renamed or dropped here; a column
    // whose meaning changes gets a NEW name so a series never silently shifts
    // definition mid-history.
    const [md] = await table.getMetadata();
    const have = new Set((md.schema.fields || []).map((f) => f.name));
    const add = WAREHOUSE_METRICS.map(([, col]) => col).filter((c) => !have.has(c));
    if (add.length) {
      md.schema.fields = [...(md.schema.fields || []), ...add.map((name) => ({ name, type: "FLOAT", mode: "NULLABLE" }))];
      await table.setMetadata(md);
      logger.info("warehouseSnapshot: schema extended", { added: add });
    }

    // Idempotent per day: clear any existing row for this date first. Best-effort
    // (a no-op if a prior row is still in the streaming buffer — worst case a dupe).
    try { await bq.query({ query: `DELETE FROM \`${BQ_DATASET}.${BQ_TABLE}\` WHERE date = DATE(@d)`, params: { d: row.date } }); }
    catch (e) { logger.warn("warehouse dedup skipped", { error: String((e && e.message) || e) }); }
  }
  await table.insert([row]);
  logger.info("warehouseSnapshot", { date: row.date, cols: Object.keys(row).length });
  return row;
}

exports.warehouseSnapshot = onSchedule(
  { schedule: "55 23 * * *", timeZone: "Africa/Johannesburg", secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 1 },
  async () => { await runWarehouseSnapshot(); },
);

exports.warehouseSnapshotNow = onRequest(
  { secrets: [HA_URL, HA_TOKEN], region: "us-central1", maxInstances: 2 },
  async (req, res) => {
    const idToken = (req.headers.authorization || "").replace("Bearer ", "");
    try { await admin.auth().verifyIdToken(idToken); }
    catch { res.status(401).json({ ok: false, error: "unauthenticated" }); return; }
    try { const row = await runWarehouseSnapshot(); res.status(200).json({ ok: true, row }); }
    catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  },
);

// ---- Explain this chart ------------------------------------------------
// One shared endpoint behind every chart in the portal. Two design choices keep
// this cheap enough to leave switched on:
//
//  1. It is given the RENDERED SERIES ONLY — the handful of points already on
//     screen — never the warehouse. Small prompt, small bill, and the answer
//     can only talk about what the user is actually looking at.
//  2. Answers are cached in Firestore on a hash of (chart + rounded series +
//     prompt version). For a daily-granularity chart that means ONE model call
//     per chart per day no matter how many times it's opened, across every
//     device in the house. Bump PROMPT_V to invalidate everything at once.
//
// Deliberately brief: two sentences. A dashboard caption, not an essay.

const PROMPT_V = "v1";

function chartCacheKey(payload) {
  const rounded = (payload.points || []).map((p) => {
    const v = typeof p.v === "number" ? Math.round(p.v * 100) / 100 : p.v;
    return `${p.t}:${v}`;
  }).join(",");
  const raw = `${PROMPT_V}|${payload.chartId}|${payload.unit || ""}|${rounded}`;
  return require("crypto").createHash("sha1").update(raw).digest("hex");
}

exports.explainChart = onCall(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 5 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (!email) throw new HttpsError("unauthenticated", "Sign in required.");

    const p = request.data || {};
    const points = Array.isArray(p.points) ? p.points.slice(0, 200) : [];
    if (!p.chartId || points.length < 2) {
      throw new HttpsError("invalid-argument", "Need chartId and at least 2 points.");
    }

    const key = chartCacheKey({ ...p, points });
    const ref = db.collection("chartExplain").doc(key);
    const hit = await ref.get();
    if (hit.exists) return { text: hit.data().text, cached: true };

    const vals = points.map((x) => Number(x.v)).filter((n) => Number.isFinite(n));
    const stats = vals.length
      ? { min: Math.min(...vals), max: Math.max(...vals), first: vals[0], last: vals[vals.length - 1],
          avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 }
      : {};

    const prompt = `You are explaining one chart on a South African family's home dashboard (solar + battery, borehole, pool).

Chart: ${p.title || p.chartId}
Unit: ${p.unit || "unknown"}
Period: ${p.period || "recent"}
Summary: ${JSON.stringify(stats)}
Series (time,value): ${points.map((x) => `${x.t},${x.v}`).join(" ")}

Write AT MOST TWO SHORT SENTENCES for a caption under the chart.
Say what actually happened and, if there is one, the single most likely reason.
Use the unit. Plain language, no preamble, no bullet points, no markdown.
If nothing notable happened, say so plainly in one sentence.`;

    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
    });
    // Flash-Lite: this is a small, frequent, low-stakes call — exactly the tier
    // Google recommends for it, and a fraction of the cost of full Flash.
    // gemini-2.5-* are gone for new keys ("no longer available to new users"),
    // verified 2026-08-09 — leaving them in just burns a failed round-trip each call.
    const models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest"];
    let lastErr = "no model";
    for (const model of models) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body,
        });
        const j = await r.json();
        if (r.ok) {
          const text = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
          if (text) {
            await ref.set({ text, chartId: p.chartId, ts: Date.now(), model });
            return { text, cached: false };
          }
        }
        lastErr = j?.error?.message || `gemini ${r.status}`;
      } catch (e) { lastErr = String((e && e.message) || e); }
    }
    logger.warn("explainChart failed", { lastErr, chartId: p.chartId });
    throw new HttpsError("unavailable", "Couldn't explain this chart right now.");
  },
);

// ---- Ask the warehouse -------------------------------------------------
// Assist talks to HA's conversation agent, which only knows the present:
// "is the alarm armed", "what's the battery level". Nothing in the house could
// answer "what did we spend on electricity in July" — and the warehouse, the
// one store that could, had never been read by any code at all.
//
// A one-row-per-day, single-table, ~30-column schema is close to the ideal
// text-to-SQL target: no joins, no ambiguity, whole schema fits in the prompt.
// So the model writes SQL and code decides whether to run it — model proposes,
// code decides, same rule as the rest of the LLM surface here.
//
// Three independent guards, because "the model wrote it" is not a safety story:
//   1. Shape: one statement, must start with SELECT/WITH, must reference only
//      the one table, and a keyword denylist for anything that writes.
//   2. Dry run: BigQuery itself validates and reports bytes. Catches invented
//      column names for free, which is the most common failure by far.
//   3. maximumBytesBilled: a hard ceiling the query cannot exceed even if the
//      first two guards were somehow wrong. The table is kilobytes; 64MB is
//      already absurdly generous, so tripping it means something is off.
const SQL_FORBIDDEN =
  /\b(insert|update|delete|merge|drop|create|alter|truncate|grant|revoke|call|export|load|begin|commit|rollback|session|assert|script)\b/i;

function validateWarehouseSql(sql) {
  const s = String(sql || "").trim().replace(/;\s*$/, "");
  if (!s) return { ok: false, why: "empty query" };
  if (s.includes(";")) return { ok: false, why: "only one statement allowed" };
  if (!/^(select|with)\b/i.test(s)) return { ok: false, why: "must be a SELECT" };
  if (SQL_FORBIDDEN.test(s)) return { ok: false, why: "query tries to modify data" };
  // Every table reference must be the daily table. Catches attempts to read
  // INFORMATION_SCHEMA or another dataset in the same project.
  const refs = [...s.matchAll(/\bfrom\s+([`\w.\-]+)|\bjoin\s+([`\w.\-]+)/gi)].map((m) =>
    (m[1] || m[2]).replace(/`/g, "").toLowerCase(),
  );
  const allowed = new Set([`${BQ_DATASET}.${BQ_TABLE}`, BQ_TABLE, `home.${BQ_TABLE}`]);
  // CTE names are legitimate FROM targets. Month-over-month and "days above
  // average" questions genuinely want a WITH clause, so refusing them would
  // push the model into worse SQL rather than making anything safer — the CTE
  // can only ever be built from an already-allowed table.
  for (const m of s.matchAll(/(?:\bwith\s+|,\s*)([a-z_]\w*)\s+as\s*\(/gi)) allowed.add(m[1].toLowerCase());
  const bad = refs.filter((r) => !allowed.has(r) && !allowed.has(r.split(".").slice(-2).join(".")));
  if (bad.length) return { ok: false, why: `can only read ${BQ_DATASET}.${BQ_TABLE}` };
  const limited = /\blimit\s+\d+/i.test(s) ? s : `${s}\nLIMIT 500`;
  return { ok: true, sql: limited };
}

async function geminiJson(prompt, maxTokens = 700) {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
  });
  const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];
  let lastErr = "no model";
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY.value()}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      const j = await r.json();
      if (r.ok) {
        const text = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        if (text) {
          try { return { data: JSON.parse(text), model }; }
          catch { lastErr = "model returned non-JSON"; continue; }
        }
      }
      lastErr = j?.error?.message || `gemini ${r.status}`;
    } catch (e) { lastErr = String((e && e.message) || e); }
  }
  throw new HttpsError("unavailable", lastErr);
}

// Column meanings the model cannot infer from a name. Only the ones where a
// wrong reading would produce a confidently wrong answer.
const COLUMN_NOTES = {
  battery_soc: "battery level at end of day (23:55), NOT the day's low",
  battery_soc_min: "lowest battery level reached that day — use this for 'how low did it get'",
  tank_pct: "tank level at end of day, NOT the day's low",
  indoor_temp: "indoor temperature at 23:55, NOT a daily average — use indoor_temp_min/max for extremes",
  outdoor_temp: "outdoor temperature at 23:55, NOT a daily average",
  energy_cost: "grid electricity cost for that day, in South African rand",
  grid_independence_pct: "percent of the day's energy that did not come from the grid",
  base_load_w: "always-on floor: the lowest the house load got, in watts",
  peak_load_w: "highest the house load reached, in watts",
  off_grid_hours: "hours the house ran without the grid",
  loadshed_urgency: "load shedding urgency score, higher is worse",
  water_pump_min: "pressure pump runtime in minutes",
  alarm_armed_hours: "hours the house alarm was armed",
  vehicles: "vehicles counted passing the property",
  pedestrians: "pedestrians counted passing the property",
  oura_readiness: "Christo's Oura readiness score",
  oura_sleep: "Christo's Oura sleep score",
};

exports.askWarehouse = onCall(
  { secrets: [GEMINI_API_KEY], region: "us-central1", maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (!email) throw new HttpsError("unauthenticated", "Sign in required.");

    const question = String((request.data && request.data.question) || "").trim().slice(0, 400);
    if (question.length < 3) throw new HttpsError("invalid-argument", "Ask a question.");

    const bq = new BigQuery();
    const table = bq.dataset(BQ_DATASET).table(BQ_TABLE);
    const [tExists] = await table.exists();
    if (!tExists) throw new HttpsError("failed-precondition", "No history stored yet.");

    // Schema is read live, so the answer surface grows with the table on its own
    // — adding a column to WAREHOUSE_METRICS makes it askable the same night.
    const [md] = await table.getMetadata();
    const fields = (md.schema.fields || []).map((f) => f.name);
    const schemaText = fields
      .map((f) => (COLUMN_NOTES[f] ? `  ${f} — ${COLUMN_NOTES[f]}` : `  ${f}`))
      .join("\n");

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const plan = await geminiJson(`You write BigQuery Standard SQL for one table of daily home metrics.

Table: \`${BQ_DATASET}.${BQ_TABLE}\` — exactly one row per calendar day.
Today is ${today} (Africa/Johannesburg). Columns:
${schemaText}

Question: ${question}

Return JSON only:
{"sql": "...", "title": "short chart title", "unit": "unit or empty string",
 "x": "column for the x axis or empty", "y": ["value columns"], "chart": "line|bar|none"}

Rules:
- One SELECT statement. Never modify data. Only this table.
- Any column may be NULL for days it wasn't measured — ignore NULLs rather than treating them as zero.
- Prefer explicit date filters over relying on row order, and ORDER BY date for time series.
- If the question needs a column that does not exist, return {"sql":"","title":"","unit":"","x":"","y":[],"chart":"none"}.`);

    const raw = (plan.data && plan.data.sql) || "";
    if (!raw) throw new HttpsError("not-found", "The house doesn't record that yet.");

    const v = validateWarehouseSql(raw);
    if (!v.ok) {
      logger.warn("askWarehouse rejected sql", { why: v.why, question, sql: raw.slice(0, 300) });
      throw new HttpsError("invalid-argument", `Couldn't run that safely: ${v.why}.`);
    }

    // Dry run first: BigQuery validates the SQL and prices it before anything
    // executes, so an invented column name costs nothing and returns a real
    // error message rather than a plausible wrong answer.
    try {
      await bq.createQueryJob({ query: v.sql, dryRun: true, useLegacySql: false });
    } catch (e) {
      const why = String((e && e.message) || e).split("\n")[0].slice(0, 200);
      logger.warn("askWarehouse dry run failed", { why, sql: v.sql.slice(0, 300) });
      throw new HttpsError("invalid-argument", "I couldn't turn that into a valid query. Try asking it a different way.");
    }

    const [rows] = await bq.query({ query: v.sql, useLegacySql: false, maximumBytesBilled: "67108864" });

    // Dates come back as BigQuery date objects; flatten to plain values so the
    // portal and the summariser see the same thing.
    const flat = rows.slice(0, 500).map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, val]) => [k, val && typeof val === "object" && "value" in val ? val.value : val])),
    );

    // Summarise the ACTUAL rows, not the question. The model never gets to
    // invent the number — it only puts words around what the query returned.
    let answer = "";
    if (flat.length) {
      try {
        const sum = await geminiJson(`A South African family asked about their home's history: "${question}"

The query returned these rows (JSON): ${JSON.stringify(flat.slice(0, 60))}
Unit: ${plan.data.unit || "unknown"}

Return JSON: {"answer": "..."}
At most two short sentences answering the question directly from these rows.
Use the numbers as given, rounded sensibly, with the unit. Rand amounts as R123.
Plain language, no preamble, no markdown. If the rows don't answer it, say so.`, 200);
        answer = String((sum.data && sum.data.answer) || "").trim();
      } catch (e) {
        logger.warn("askWarehouse summary failed", { error: String((e && e.message) || e) });
      }
    } else {
      answer = "No days match that.";
    }

    return {
      answer,
      rows: flat,
      sql: v.sql,
      title: String(plan.data.title || "").slice(0, 80),
      unit: String(plan.data.unit || "").slice(0, 16),
      x: String(plan.data.x || ""),
      y: Array.isArray(plan.data.y) ? plan.data.y.slice(0, 4).map(String) : [],
      chart: ["line", "bar"].includes(plan.data.chart) ? plan.data.chart : "none",
    };
  },
);
