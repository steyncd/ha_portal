// Alarms as objects, with acknowledgement and maintenance windows.
// PLATFORM-CONCEPTS §3.
//
// Today an attention item is a computed row: it cannot be acknowledged, has no
// history, and returns on the next evaluation. Over months that is the whole
// difference between a list you read and a list you ignore — because the only
// way to make an item go away is to fix it, and some things take a fortnight.
//
// Lifecycle: raise → (acknowledge | snooze) → clear. Acknowledging removes it
// from the BADGE but never from the RECORD, which is the distinction that lets
// you say "I know" without pretending it did not happen.
//
// MAINTENANCE WINDOWS ARE THE SAME SHAPE, GENERALISED. While one is open, every
// alarm, digest line and staleness badge for that target goes quiet, and the
// suppression is visible with its end time.
//
// THE RULE WITH TEETH: a suppression without an end time is not allowed. That is
// exactly what a bypassed alarm zone with no expiry is, and this house has one
// right now. Same rule as the visitor pass — the point is that nobody has to
// remember to undo it.

import { db } from "./firebase";
import {
  collection, doc, setDoc, getDocs, addDoc, deleteDoc, query, where, serverTimestamp,
} from "firebase/firestore";

export type Severity = "interrupt" | "digest" | "badge";

export type Alarm = {
  /** Stable, so the same condition never creates duplicates. */
  key: string;
  title: string;
  detail?: string;
  severity: Severity;
  raisedAt: number;
  clearedAt: number | null;
  ackBy: string | null;
  ackAt: number | null;
  snoozeUntil: number | null;
  /** Joins to the dependency graph. */
  entityIds: string[];
};

export type Maintenance = {
  id: string;
  /** entityId | roomId | subsystem — deliberately loose, one shape for all three. */
  target: string;
  /** Shown wherever the suppression is visible. A window with no reason is a
   *  mystery in three weeks' time. */
  reason: string;
  /** REQUIRED. There is no "indefinite". */
  endsAt: number;
  createdBy: string;
};

class AlarmStore {
  open = $state<Alarm[]>([]);
  windows = $state<Maintenance[]>([]);
  loaded = $state(false);

  /** Is this target currently suppressed, and until when. */
  suppression(target: string): Maintenance | null {
    const now = Date.now();
    return (
      this.windows.find((w) => w.endsAt > now && (w.target === target || target.startsWith(`${w.target}.`))) ?? null
    );
  }

  /**
   * The badge count. Acknowledged and snoozed items are excluded, suppressed
   * targets are excluded, and that is the whole reason the badge can be trusted
   * as the all-clear channel: it falls to zero on its own.
   */
  get badgeCount(): number {
    const now = Date.now();
    return this.open.filter(
      (a) =>
        a.clearedAt == null &&
        a.ackAt == null &&
        (a.snoozeUntil == null || a.snoozeUntil < now) &&
        !this.suppression(a.entityIds[0] ?? a.key),
    ).length;
  }

  async load() {
    try {
      const [aSnap, mSnap] = await Promise.all([
        getDocs(query(collection(db, "alarms"), where("clearedAt", "==", null))),
        getDocs(collection(db, "maintenance")),
      ]);
      this.open = aSnap.docs.map((d) => d.data() as Alarm);
      const now = Date.now();
      this.windows = mSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Maintenance, "id">) }))
        // An expired window is not a window. The sweep deletes them server-side;
        // this filter means a stale read cannot suppress anything.
        .filter((w) => w.endsAt > now);
      this.loaded = true;
    } catch {
      // Offline or rules-denied: an empty list is the safe answer, because it
      // suppresses nothing rather than silencing everything.
      this.loaded = true;
    }
  }

  /** Raise, or refresh an existing raise. Keyed, so no duplicates. */
  async raise(a: Omit<Alarm, "raisedAt" | "clearedAt" | "ackBy" | "ackAt" | "snoozeUntil">) {
    const existing = this.open.find((x) => x.key === a.key);
    if (existing) return existing;
    const full: Alarm = {
      ...a,
      raisedAt: Date.now(),
      clearedAt: null,
      ackBy: null,
      ackAt: null,
      snoozeUntil: null,
    };
    this.open = [...this.open, full];
    try {
      await setDoc(doc(db, "alarms", a.key), full);
      await addDoc(collection(db, "alarms", a.key, "audit"), { at: serverTimestamp(), event: "raised" });
    } catch { /* the local list still reflects it */ }
    return full;
  }

  /** "I know." Off the badge, still on the record. */
  async ack(key: string, who: string) {
    const a = this.open.find((x) => x.key === key);
    if (!a) return;
    a.ackBy = who;
    a.ackAt = Date.now();
    try {
      await setDoc(doc(db, "alarms", key), { ackBy: who, ackAt: a.ackAt }, { merge: true });
      await addDoc(collection(db, "alarms", key, "audit"), { at: serverTimestamp(), event: "acknowledged", who });
    } catch { /* local only */ }
  }

  /** "Not until Friday." Same as ack but it comes back. */
  async snooze(key: string, untilMs: number, who: string) {
    const a = this.open.find((x) => x.key === key);
    if (!a) return;
    a.snoozeUntil = untilMs;
    try {
      await setDoc(doc(db, "alarms", key), { snoozeUntil: untilMs }, { merge: true });
      await addDoc(collection(db, "alarms", key, "audit"), { at: serverTimestamp(), event: "snoozed", untilMs, who });
    } catch { /* local only */ }
  }

  async clear(key: string) {
    const a = this.open.find((x) => x.key === key);
    if (!a) return;
    a.clearedAt = Date.now();
    this.open = this.open.filter((x) => x.key !== key);
    try {
      await setDoc(doc(db, "alarms", key), { clearedAt: a.clearedAt }, { merge: true });
      await addDoc(collection(db, "alarms", key, "audit"), { at: serverTimestamp(), event: "cleared" });
    } catch { /* local only */ }
  }

  /**
   * Open a maintenance window. `endsAt` is required by the type, and rejected
   * here as well if it is not in the future — the rule has to bite at the point
   * of creation, or "temporary" becomes permanent by accident.
   */
  async openWindow(w: Omit<Maintenance, "id">) {
    if (!(w.endsAt > Date.now())) {
      throw new Error("A maintenance window must end in the future. There is no indefinite suppression.");
    }
    if (!w.reason.trim()) {
      throw new Error("A maintenance window needs a reason — otherwise it is a mystery in three weeks.");
    }
    const ref = await addDoc(collection(db, "maintenance"), w);
    this.windows = [...this.windows, { id: ref.id, ...w }];
    return ref.id;
  }

  async closeWindow(id: string) {
    this.windows = this.windows.filter((w) => w.id !== id);
    try { await deleteDoc(doc(db, "maintenance", id)); } catch { /* local only */ }
  }
}

export const alarms = new AlarmStore();

/** Common snooze targets, in the words people actually use. */
export function snoozeOptions(now = new Date()): { label: string; until: number }[] {
  const d = (days: number) => {
    const t = new Date(now);
    t.setDate(t.getDate() + days);
    t.setHours(8, 0, 0, 0);
    return t.getTime();
  };
  const friday = () => {
    const t = new Date(now);
    const delta = (5 - t.getDay() + 7) % 7 || 7;
    t.setDate(t.getDate() + delta);
    t.setHours(8, 0, 0, 0);
    return t.getTime();
  };
  return [
    { label: "Tomorrow", until: d(1) },
    { label: "Until Friday", until: friday() },
    { label: "A week", until: d(7) },
  ];
}
