// Household — chores, trust, ledger, TV audit. Phase 5.2.
//
// THE RULE UNDER ALL OF IT: the reward for reliability is being asked less. The
// trust meter is not a score, it is a countdown to being left alone. Everything
// below follows from that.
//
// Three trust levels, and which one a chore is at is a property of the CHILD's
// standing on that chore, not of the chore itself:
//
//   photo   — send a photo, a parent approves it
//   timed   — auto-approves after a delay the child can SEE, parent may veto
//   self    — say you are done and you are done
//
// The money moves the moment it is real, never on payday. A balance that only
// updates on Friday is not a consequence of today's work, and an 11-year-old
// reading it on Wednesday learns that the two are unrelated.

export type Level = "photo" | "timed" | "self";
export type ChoreState = "todo" | "sent" | "counting" | "done";

export type Chore = {
  id: string;
  who: "liam" | "eben";
  /** Afrikaans — these are the child's own words, not chrome. */
  label: string;
  value: number;
  level: Level;
  state: ChoreState;
  /** Epoch ms when a `counting` chore auto-approves. */
  approvesAt?: number;
};

export type Person = { id: "liam" | "eben"; name: string; balance: number; trust: number };

/** Minutes a timed chore waits before it approves itself. */
const TIMED_MINUTES = 30;

/** Consecutive approvals needed to stop being asked. */
export const TRUST_TARGET = 5;

class Chores {
  items = $state<Chore[]>([
    { id: "c1", who: "liam", label: "Ruim die studeerkamer op", value: 20, level: "photo", state: "todo" },
    { id: "c2", who: "liam", label: "Vullis uit", value: 8, level: "timed", state: "todo" },
    { id: "c3", who: "liam", label: "Maak jou bed op", value: 5, level: "self", state: "todo" },
    { id: "e1", who: "eben", label: "Tande geposts", value: 0, level: "self", state: "todo" },
    { id: "e2", who: "eben", label: "Klere in die wasgoedmandjie", value: 0, level: "self", state: "todo" },
    { id: "e3", who: "eben", label: "Speelgoed weggepak", value: 0, level: "self", state: "todo" },
    { id: "e4", who: "eben", label: "Skoolsak reg vir môre", value: 0, level: "self", state: "todo" },
  ]);

  /** Anything a parent still has to look at. */
  get pending() {
    return this.items.filter((c) => c.state === "sent");
  }
  get counting() {
    return this.items.filter((c) => c.state === "counting");
  }
  forWho(who: "liam" | "eben") {
    return this.items.filter((c) => c.who === who);
  }

  /**
   * The child taps. What happens next depends only on their standing.
   *
   * `self` goes straight to done — that is what the trust was FOR. `timed`
   * starts a visible countdown. `photo` goes to `sent` and waits for a person.
   */
  tap(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (!c || c.state !== "todo") return;
    if (c.level === "self") this.#complete(c);
    else if (c.level === "timed") {
      c.state = "counting";
      c.approvesAt = Date.now() + TIMED_MINUTES * 60_000;
    } else c.state = "sent";
  }

  /** A parent approving — from the sheet, or from the digest action. */
  approve(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (!c || c.state === "done") return;
    this.#complete(c);
  }

  approveAll() {
    // Returns what it did, so the caller can offer a real undo rather than a
    // hardcoded inverse.
    const changed = this.items.filter((c) => c.state === "sent" || c.state === "counting");
    const before = changed.map((c) => ({ id: c.id, state: c.state, approvesAt: c.approvesAt }));
    for (const c of changed) this.#complete(c);
    return {
      count: changed.length,
      value: changed.reduce((s, c) => s + c.value, 0),
      undo: () => {
        for (const b of before) {
          const c = this.items.find((x) => x.id === b.id);
          if (!c) continue;
          c.state = b.state;
          c.approvesAt = b.approvesAt;
          ledger.credit(c.who, -c.value);
          ledger.trustDown(c.who, true);
        }
      },
    };
  }

  /** A parent using their veto on a timed chore before it lands. */
  reject(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (!c) return;
    c.state = "todo";
    c.approvesAt = undefined;
    ledger.trustDown(c.who);
  }

  #complete(c: Chore) {
    c.state = "done";
    c.approvesAt = undefined;
    ledger.credit(c.who, c.value);
    ledger.trustUp(c.who);
  }

  /** Drives the visible countdown, and lets expired timers land. */
  tick() {
    const now = Date.now();
    for (const c of this.items) {
      if (c.state === "counting" && c.approvesAt != null && c.approvesAt <= now) {
        // Silent on purpose: a chore that completes correctly should notify
        // nobody. Only exceptions are worth a message.
        this.#complete(c);
      }
    }
  }

  minutesLeft(c: Chore): number | null {
    if (c.state !== "counting" || c.approvesAt == null) return null;
    return Math.max(0, Math.ceil((c.approvesAt - Date.now()) / 60_000));
  }
}

class Ledger {
  people = $state<Person[]>([
    { id: "liam", name: "Liam", balance: 48.5, trust: 5 },
    // Eben has no money and no trust meter: the tick is the reward, and a
    // number to compare against his brother's is the fastest way to poison it.
    { id: "eben", name: "Eben", balance: 0, trust: 0 },
  ]);
  approvedThisMonth = $state(41);

  get total() {
    return this.people.reduce((s, p) => s + p.balance, 0);
  }
  person(id: "liam" | "eben") {
    return this.people.find((p) => p.id === id)!;
  }

  credit(who: "liam" | "eben", amount: number) {
    if (who === "eben" || !amount) return;
    const p = this.person(who);
    p.balance = Math.round((p.balance + amount) * 100) / 100;
    if (amount > 0) this.approvedThisMonth += 1;
  }

  trustUp(who: "liam" | "eben") {
    if (who === "eben") return;
    const p = this.person(who);
    p.trust = Math.min(TRUST_TARGET, p.trust + 1);
  }

  /**
   * Trust loss. Three rules, and they are the design:
   *
   * 1. DEMOTION IS ONE LEVEL, NEVER TO ZERO. Self-certifying drops to timed,
   *    timed drops to photo. Losing a week of standing for one bad day is how a
   *    child stops trying.
   * 2. The copy that renders this always names the way back, in the same breath.
   * 3. Amber, and only here — it is the one place in the kids' shell where
   *    something has actually gone backwards.
   */
  trustDown(who: "liam" | "eben", silent = false) {
    if (who === "eben") return;
    const p = this.person(who);
    p.trust = Math.max(0, p.trust - (silent ? 0 : 1));
  }
}

export const chores = new Chores();
export const ledger = new Ledger();

/** The level a child is currently held to, derived from trust rather than stored. */
export function levelFor(trust: number): Level {
  if (trust >= TRUST_TARGET) return "self";
  if (trust >= 2) return "timed";
  return "photo";
}

/**
 * Trust copy. Always names the way back — "you are on photos" alone gives a
 * child nowhere to go.
 */
export function trustCopy(trust: number): { text: string; tone: "ok" | "acc" | "warn" } {
  if (trust >= TRUST_TARGET)
    return { text: "Klaar. Dit vra nie meer nie — jy sê net wanneer jy klaar is.", tone: "ok" };
  if (trust >= 2)
    return { text: `Nog ${TRUST_TARGET - trust} keer reg, dan hou dit op vra.`, tone: "acc" };
  return { text: "Terug na foto's vir eers. Twee keer reg en die timer kom terug.", tone: "warn" };
}

// ── TV audit ────────────────────────────────────────────────────────────────
// One question: "how much, and was it what we thought?" This week against last,
// because a week is the unit a household actually manages and the comparison is
// the only number with any meaning.
export type TvWeek = {
  total: number | null;
  delta: number | null;
  people: { name: string; hours: number; titles: string[] }[];
};

export const tvWeek: TvWeek = {
  total: 9.3,
  delta: 1.1,
  people: [
    { name: "Liam", hours: 4.2, titles: ["Bluey", "Lego Masters", "rugby"] },
    { name: "Eben", hours: 2.8, titles: ["Bluey", "Paw Patrol"] },
    { name: "Almal saam", hours: 2.3, titles: ["Sondagfliek"] },
  ],
};
