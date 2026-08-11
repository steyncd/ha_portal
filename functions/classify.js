// Pure capture-grammar + monthly-due-day math, shared by index.js and unit-
// tested in isolation (no firebase-admin import, so tests don't need creds).
// Keep the due-day math in sync with the portal's src/lib/lifeCalc.ts.

const FAM = ["christo", "mandri", "liam", "eben"];

// "add/task/chore/to-do/note/remind …" -> a task/chore; "buy/purchase/pick up/
// grab …" -> the shopping list. Both require some text after the verb.
const TASK_RE = /^\s*(add|task|chore|to-?do|note|remind(?:\s+me)?(?:\s+to)?)\b[:\s]*/i;
const SHOP_RE = /^\s*(buy|purchase|shop(?:\s+for)?|pick\s*up|grab)\b[:\s]*/i;

/**
 * Map a WhatsApp sender number to a family key (Mandri's number, else Christo).
 * @param {string} sender
 * @returns {"mandri" | "christo"}
 */
function senderKey(sender) {
  const d = (String(sender).match(/\d+/g) || []).join("");
  return d.endsWith("731659285") ? "mandri" : "christo";
}

/**
 * Classify an inbound message into { kind, text, verb }.
 * kind: "shop" | "task" | "chore" | null (null = not a capture / no text).
 * @param {string} message
 * @returns {{ kind: "shop" | "task" | "chore" | null, text: string, verb?: string }}
 */
function classifyMessage(message) {
  const msg = String(message);
  const s = msg.match(SHOP_RE);
  if (s) {
    const text = msg.slice(s[0].length).trim();
    return text ? { kind: "shop", text, verb: s[1] } : { kind: null, text: "" };
  }
  const t = msg.match(TASK_RE);
  if (t) {
    const text = msg.slice(t[0].length).trim();
    if (!text) return { kind: null, text: "" };
    return { kind: /^chore/i.test(t[1]) ? "chore" : "task", text, verb: t[1] };
  }
  return { kind: null, text: "" };
}

/**
 * Days until the next occurrence of a monthly due-day (clamped to month length).
 * @param {number} dueDay
 * @param {number} ref epoch ms of the reference "now"
 * @returns {number}
 */
function dueInDaysServer(dueDay, ref) {
  const now = new Date(ref);
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear(), m = now.getMonth();
  const clamp = (/** @type {number} */ yr, /** @type {number} */ mo) => Math.min(dueDay, new Date(yr, mo + 1, 0).getDate());
  let next = new Date(y, m, clamp(y, m));
  if (next.getTime() < now.getTime()) {
    const nm = new Date(y, m + 1, 1);
    next = new Date(nm.getFullYear(), nm.getMonth(), clamp(nm.getFullYear(), nm.getMonth()));
  }
  return Math.round((next.getTime() - now.getTime()) / 864e5);
}

module.exports = { FAM, TASK_RE, SHOP_RE, senderKey, classifyMessage, dueInDaysServer };
