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
