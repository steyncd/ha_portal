// "What you actually do" engine — the intelligence behind the Home surface's
// "Suggested for now" strip.
//
// Research finding (Alexa Hunches / Google Home / Apple Siri Suggestions, plus
// our own 14-day usage pull): Home Assistant's state history is DOMINATED by
// automations — the pumps top the "most active" list purely because of solar /
// borehole scheduling, not because anyone touches them. So ranking raw entity
// changes recommends things the house already does itself. Instead we score the
// quick-action taps the user actually makes IN THE PORTAL — a clean, human-only
// signal, immune to that automation pollution.
//
// Scoring is frecency (Firefox's algorithm: frequency + recency with an
// exponential decay), bucketed by time-of-day so "Goodnight" surfaces at night
// and "Morning" by day. Events live in localStorage (per-device, instant, no
// backend round-trip) and are mirrored best-effort to Firestore `action_log`
// for future cross-device / server-side ranking.

import { db } from "./firebase";
import { authStore } from "./auth.svelte";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const KEY = "ha_portal_actionlog";
const CAP = 1500; // ring-buffer cap on retained events (~months of normal use)
const HALF_LIFE_DAYS = 30; // a tap's weight halves every 30 days
const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;

export type Bucket = "night" | "morning" | "midday" | "afternoon" | "evening" | "late";

/** Coarse time-of-day bucket (local time). Kept small (6 buckets) per the
 *  research — enough to separate morning/evening/night without over-fitting. */
export function bucketFor(d = new Date()): Bucket {
  const h = d.getHours();
  if (h < 5) return "night";
  if (h < 9) return "morning";
  if (h < 13) return "midday";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "late";
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  night: "overnight", morning: "in the morning", midday: "around midday",
  afternoon: "in the afternoon", evening: "in the evening", late: "late at night",
};

/** kind: "a" = a deliberate quick-action tap, "v" = a view/feature opened.
 *  Absent on events written before view-tracking existed → treated as "a". */
type Ev = { a: string; t: number; b: Bucket; k?: "a" | "v" };

class ActionLog {
  // Reactive so the Home suggestion strip recomputes the moment a tap lands.
  events = $state<Ev[]>([]);

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.events = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.events = [];
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.events.slice(-CAP)));
    } catch {
      /* storage full / disabled — frecency still works in-memory this session */
    }
  }

  /** Record one deliberate quick-action tap. Call on every Home/Favourites/
   *  scene tap. Automation-driven state changes must NEVER be recorded here. */
  record(actionId: string) {
    this.#push(actionId, "a");
  }

  /** Record a view/feature being opened. Unlike the old access log this is NOT
   *  deduped per session — every open counts, because the whole point is to
   *  measure which features are genuinely reached for most often. */
  recordView(viewId: string) {
    this.#push(viewId, "v");
  }

  #push(id: string, kind: "a" | "v") {
    const now = Date.now();
    const ev: Ev = { a: id, t: now, b: bucketFor(new Date(now)), k: kind };
    this.events = [...this.events, ev].slice(-CAP);
    this.#save();
    // Best-effort durable mirror (cross-device + server-side ranking later).
    // Never blocks or throws — a rules denial just means local-only for now.
    const email = authStore.user?.email;
    if (email) {
      addDoc(collection(db, "action_log"), {
        email: email.toLowerCase(),
        action: id,
        kind: kind === "v" ? "view" : "action",
        bucket: ev.b,
        ts: serverTimestamp(),
      }).catch(() => {});
    }
  }

  /**
   * Frecency score for one action right now — a blend of its all-day weight and
   * its weight in the current time bucket, so an action that's rare overall but
   * strong at this hour (e.g. "Goodnight" at 22:00) beats an all-day-common one.
   */
  score(actionId: string, now = Date.now(), bucket = bucketFor(new Date(now)), kind: "a" | "v" = "a"): number {
    let global = 0;
    let ctx = 0;
    for (const e of this.events) {
      if (e.a !== actionId || (e.k ?? "a") !== kind) continue;
      const ageDays = (now - e.t) / 86_400_000;
      const w = Math.exp(-LAMBDA * ageDays);
      global += w;
      if (e.b === bucket) ctx += w;
    }
    return 0.45 * global + 0.55 * ctx;
  }

  /** Raw lifetime count for an action (used for the "you've used this N×" hint). */
  count(actionId: string, kind: "a" | "v" = "a"): number {
    let n = 0;
    for (const e of this.events) if (e.a === actionId && (e.k ?? "a") === kind) n++;
    return n;
  }

  /** Total quick-action taps recorded — drives cold-start vs learned. */
  get total(): number {
    let n = 0;
    for (const e of this.events) if ((e.k ?? "a") === "a") n++;
    return n;
  }

  /**
   * Everything of one kind, ranked. Returns both the decayed frecency `score`
   * (what the UI orders by) and the raw `count` + `last` timestamp, so the
   * Usage panel can show "how often" and "how recently" honestly.
   */
  rank(kind: "a" | "v" = "a", now = Date.now()): { id: string; score: number; count: number; last: number }[] {
    const agg = new Map<string, { score: number; count: number; last: number }>();
    for (const e of this.events) {
      if ((e.k ?? "a") !== kind) continue;
      const w = Math.exp(-LAMBDA * ((now - e.t) / 86_400_000));
      const cur = agg.get(e.a) ?? { score: 0, count: 0, last: 0 };
      cur.score += w;
      cur.count += 1;
      cur.last = Math.max(cur.last, e.t);
      agg.set(e.a, cur);
    }
    return [...agg.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.score - a.score);
  }

  /** Oldest retained event timestamp — "tracking since" for the Usage panel. */
  get since(): number | null {
    return this.events.length ? this.events[0].t : null;
  }

  /** Wipe all usage history (privacy control in the Usage panel). */
  clear() {
    this.events = [];
    this.#save();
  }
}

export const actionLog = new ActionLog();
