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

type Ev = { a: string; t: number; b: Bucket };

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
    const now = Date.now();
    const ev: Ev = { a: actionId, t: now, b: bucketFor(new Date(now)) };
    this.events = [...this.events, ev].slice(-CAP);
    this.#save();
    // Best-effort durable mirror (future server-side ranking / cross-device).
    // Never blocks or throws — a rules denial just means local-only for now.
    const email = authStore.user?.email;
    if (email) {
      addDoc(collection(db, "action_log"), {
        email: email.toLowerCase(),
        action: actionId,
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
  score(actionId: string, now = Date.now(), bucket = bucketFor(new Date(now))): number {
    let global = 0;
    let ctx = 0;
    for (const e of this.events) {
      if (e.a !== actionId) continue;
      const ageDays = (now - e.t) / 86_400_000;
      const w = Math.exp(-LAMBDA * ageDays);
      global += w;
      if (e.b === bucket) ctx += w;
    }
    return 0.45 * global + 0.55 * ctx;
  }

  /** Raw lifetime tap count for an action (used for the "you've used this N×" hint). */
  count(actionId: string): number {
    let n = 0;
    for (const e of this.events) if (e.a === actionId) n++;
    return n;
  }

  /** Total taps recorded — drives the cold-start vs learned distinction. */
  get total(): number {
    return this.events.length;
  }
}

export const actionLog = new ActionLog();
