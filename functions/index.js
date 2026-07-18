// Public webhook proxy: TextMeBot -> Firebase -> Home Assistant.
//
// TextMeBot POSTs each inbound WhatsApp message here. We forward it to HA's
// authenticated REST API (which works reliably over the Nabu Casa remote URL,
// unlike the raw /api/webhook path), calling script.wa_process_message — the
// single routing brain that lives in Home Assistant (packages/feature_wa_inbound.yaml).
//
// Secrets (set with `firebase functions:secrets:set NAME`):
//   HA_URL             e.g. https://<id>.ui.nabu.casa   (your Nabu Casa remote URL)
//   HA_TOKEN           a Home Assistant long-lived access token
//   WA_WEBHOOK_SECRET  a random string; callers must pass ?key=<it>
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const HA_URL = defineSecret("HA_URL");
const HA_TOKEN = defineSecret("HA_TOKEN");
const WA_WEBHOOK_SECRET = defineSecret("WA_WEBHOOK_SECRET");

exports.waInbound = onRequest(
  { secrets: [HA_URL, HA_TOKEN, WA_WEBHOOK_SECRET], region: "us-central1" },
  async (req, res) => {
    // Shared-secret gate so only TextMeBot (with the key) can reach HA.
    const expected = WA_WEBHOOK_SECRET.value();
    if (expected && req.query.key !== expected) {
      res.status(403).send("forbidden");
      return;
    }

    const b = req.body || {};
    // TextMeBot sends { type, from, from_name, to, file, message }
    const message = (b.message || b.text || b.body || b.Body || "").toString().trim();
    const sender = (b.from || b.sender || b.From || "").toString();

    if (!message) {
      res.status(200).send("no message");
      return;
    }

    try {
      const r = await fetch(`${HA_URL.value()}/api/services/script/wa_process_message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HA_TOKEN.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sender }),
      });
      logger.info("forwarded to HA", { sender, message, status: r.status });
      res.status(200).send(r.ok ? "ok" : `ha ${r.status}`);
    } catch (e) {
      logger.error("forward failed", e);
      // 200 so TextMeBot doesn't retry-storm on a transient HA hiccup.
      res.status(200).send("error");
    }
  },
);
