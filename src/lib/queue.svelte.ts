// Offline command queue — Phase 2.2.
//
// When the socket is down, a tap has to go somewhere. Three rules make this
// safe rather than dangerous:
//
//  1. SOME ACTIONS ARE NEVER QUEUED. Alarm and gate/lock commands fail loudly
//     instead. A queued "disarm" that lands twenty minutes later, after you have
//     given up and used the keypad, is worse than a tap that plainly didn't
//     work. Same for a gate: you must know *now* whether it opened.
//  2. ENTRIES EXPIRE. A "turn on the geyser" queued during an outage must not
//     fire at 02:00 when the socket happens to come back. That is a safety
//     property, not a nicety, so the TTL is short and enforced on replay too.
//  3. ENTRIES COLLAPSE PER TARGET. Five frustrated taps on the same light while
//     offline are one intent, not five commands.
//
// Replay is never automatic: on reconnect the user confirms each action. The
// brief is explicit about that, and it's the right call — the house may have
// changed while we were blind.

export type Queued = {
  id: string;
  /** Collapse key. Same key replaces the earlier entry. */
  key: string;
  /** Human description, shown in the confirm list. */
  label: string;
  at: number;
  run: () => unknown;
};

// Domains whose commands must fail loudly rather than queue.
//
// The brief names the alarm and the gate. `cover` covers the gate class in
// principle, but as it happens this house has NO cover or lock entities at all
// — every gate and door in entities.ts ACCESS is a read-only Olarm zone sensor,
// so there is no gate command to queue in the first place. The domains stay
// listed anyway: the day a cover entity does appear, it must not silently
// become queueable because nobody remembered this rule.
//
// `button` and `input_button` are here for the same reason a script is: a
// button press is a momentary event with no state to reconcile. Replaying one
// three minutes late doesn't "catch up" — it fires a fresh action at a moment
// nobody chose.
const NEVER_QUEUE = ["alarm_control_panel", "lock", "cover", "button", "input_button"];

/** Also refuse anything that isn't idempotent — scripts and scenes. */
const NEVER_QUEUE_SERVICE = ["script", "scene", "automation"];

export const TTL_MS = 3 * 60_000;

export function isQueueable(entityIdOrDomain: string): boolean {
  const domain = entityIdOrDomain.includes(".")
    ? entityIdOrDomain.split(".")[0]
    : entityIdOrDomain;
  return !NEVER_QUEUE.includes(domain) && !NEVER_QUEUE_SERVICE.includes(domain);
}

class CommandQueue {
  items = $state<Queued[]>([]);
  /** True while the confirm list is showing after a reconnect. */
  reviewing = $state(false);

  get count(): number {
    return this.items.length;
  }

  #uid(): string {
    return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Queue an action. Returns false when the action must NOT be queued — the
   * caller should then surface a loud failure instead of pretending success.
   */
  push(entry: { key: string; label: string; target?: string; run: () => unknown }): boolean {
    if (entry.target && !isQueueable(entry.target)) return false;
    this.sweep();
    const next = this.items.filter((i) => i.key !== entry.key);
    next.push({
      id: this.#uid(),
      key: entry.key,
      label: entry.label,
      at: Date.now(),
      run: entry.run,
    });
    this.items = next;
    return true;
  }

  /** Drop anything past its TTL. Called on push, on review, and on a timer. */
  sweep(): number {
    const cutoff = Date.now() - TTL_MS;
    const before = this.items.length;
    this.items = this.items.filter((i) => i.at >= cutoff);
    return before - this.items.length;
  }

  /** Open the confirm list — called when the socket comes back. */
  review() {
    this.sweep();
    this.reviewing = this.items.length > 0;
  }

  runOne(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    this.items = this.items.filter((i) => i.id !== id);
    if (!this.items.length) this.reviewing = false;
    // Expired between review and confirm — refuse rather than fire late.
    if (Date.now() - item.at > TTL_MS) return;
    item.run();
  }

  drop(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
    if (!this.items.length) this.reviewing = false;
  }

  clear() {
    this.items = [];
    this.reviewing = false;
  }
}

export const queue = new CommandQueue();
