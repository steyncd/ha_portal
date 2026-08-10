// Trust levels over the REAL chores engine. Design answer §D.1.
//
// This replaces an earlier version of the household layer that carried its own
// hard-coded chores, a hard-coded R48,50 balance and an invented TV history. That
// was a straight violation of the project's own first ground rule — a wrong
// number is worse than no number — and worse than usual, because the wrong number
// was a child's money on a screen that child opens.
//
// So: no data of its own. Chores, balances and payouts stay in src/lib/kids.ts,
// which is Firestore-backed and already posts payouts into the finance project.
// What lives here is the ONE thing that engine has no concept of — how much the
// house currently trusts a child to say "done" without proof.
//
// The rule under all of it: THE REWARD FOR RELIABILITY IS BEING ASKED LESS. The
// meter is not a score, it is a countdown to being left alone.

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type Level = "photo" | "timed" | "self";

/** Consecutive approvals before the house stops asking. */
export const TRUST_TARGET = 5;

/** Minutes a `timed` chore waits before approving itself. */
export const TIMED_MINUTES = 30;

export type TrustState = {
  /** 0–TRUST_TARGET. Absent means "never assessed", which reads as 0. */
  streak?: number;
  /** Chore id → epoch ms it auto-approves. Only `timed` chores appear. */
  pending?: Record<string, number>;
  /** Chore ids waiting on a parent looking at a photo. */
  awaitingPhoto?: string[];
};

class TrustStore {
  byKid = $state<Record<string, TrustState>>({});

  watch(slug: string): () => void {
    return onSnapshot(
      doc(db, "kids_trust", slug),
      (snap) => { this.byKid = { ...this.byKid, [slug]: (snap.data() as TrustState) ?? {} }; },
      // Rules-denied or offline: an empty state means level "photo", which is the
      // SAFE direction — it asks for proof rather than granting trust nobody
      // recorded.
      () => { this.byKid = { ...this.byKid, [slug]: {} }; },
    );
  }

  state(slug: string): TrustState {
    return this.byKid[slug] ?? {};
  }
  streak(slug: string): number {
    return Math.max(0, Math.min(TRUST_TARGET, this.state(slug).streak ?? 0));
  }

  /** The level this child is currently held to — derived, never stored twice. */
  level(slug: string): Level {
    const s = this.streak(slug);
    if (s >= TRUST_TARGET) return "self";
    if (s >= 2) return "timed";
    return "photo";
  }

  async up(slug: string) {
    const next = Math.min(TRUST_TARGET, this.streak(slug) + 1);
    await this.#write(slug, { streak: next });
  }

  /**
   * Trust loss. DEMOTION IS ONE LEVEL, NEVER TO ZERO — losing a week of standing
   * for one bad day is how a child stops trying. Dropping the streak to the floor
   * of the level below is exactly one step down.
   */
  async down(slug: string) {
    const s = this.streak(slug);
    const next = s >= TRUST_TARGET ? TRUST_TARGET - 1 : s >= 2 ? 1 : 0;
    await this.#write(slug, { streak: next });
  }

  async startTimer(slug: string, choreId: string) {
    const pending = { ...(this.state(slug).pending ?? {}), [choreId]: Date.now() + TIMED_MINUTES * 60_000 };
    await this.#write(slug, { pending });
  }
  async clearTimer(slug: string, choreId: string) {
    const pending = { ...(this.state(slug).pending ?? {}) };
    delete pending[choreId];
    await this.#write(slug, { pending });
  }
  async awaitPhoto(slug: string, choreId: string) {
    const list = [...(this.state(slug).awaitingPhoto ?? [])];
    if (!list.includes(choreId)) list.push(choreId);
    await this.#write(slug, { awaitingPhoto: list });
  }
  async clearPhoto(slug: string, choreId: string) {
    await this.#write(slug, { awaitingPhoto: (this.state(slug).awaitingPhoto ?? []).filter((x) => x !== choreId) });
  }

  minutesLeft(slug: string, choreId: string): number | null {
    const at = this.state(slug).pending?.[choreId];
    return at == null ? null : Math.max(0, Math.ceil((at - Date.now()) / 60_000));
  }
  expired(slug: string): string[] {
    const now = Date.now();
    return Object.entries(this.state(slug).pending ?? {}).filter(([, at]) => at <= now).map(([id]) => id);
  }

  async #write(slug: string, patch: Partial<TrustState>) {
    // Optimistic locally so the UI moves at once; Firestore is the record.
    this.byKid = { ...this.byKid, [slug]: { ...this.state(slug), ...patch } };
    try { await setDoc(doc(db, "kids_trust", slug), patch, { merge: true }); } catch { /* local stands */ }
  }
}

export const trust = new TrustStore();

/** Copy that always names the way back — "you are on photos" gives nowhere to go. */
export function trustCopy(streak: number): { text: string; tone: "ok" | "acc" | "warn" } {
  if (streak >= TRUST_TARGET)
    return { text: "Klaar. Dit vra nie meer nie — jy sê net wanneer jy klaar is.", tone: "ok" };
  if (streak >= 2)
    return { text: `Nog ${TRUST_TARGET - streak} keer reg, dan hou dit op vra.`, tone: "acc" };
  return { text: "Terug na foto's vir eers. Twee keer reg en die timer kom terug.", tone: "warn" };
}
