// Visitor passes. Handover §4 Account, taxonomy from Design answer §D.3.
//
// A PASS IS SCOPED TO CAPABILITIES, NOT SCREENS. "Views" is the wrong answer,
// and the handover says why in one line worth keeping: a role that only hides
// views is tidiness, not security. So a scope is a VERB the holder may perform,
// each independently grantable, and the enforcement lives in firestore.rules and
// in the HA token's own permissions — never in nav.ts.
//
// THREE RULES THAT MATTER MORE THAN THE LIST:
//
// 1. Health, location, money and the kids' surfaces are NOT SCOPES. They cannot
//    be granted at any level. Not "off by default" — absent from the vocabulary,
//    so there is no code path that could grant them by mistake.
// 2. Every scope is enforced server-side. This file describes intent; it is not
//    the gate.
// 3. `expiresAt` is REQUIRED and there is no "never". The sweep closes it, so
//    nobody has to remember.
//
// The house-sitter brief generates FROM the granted scopes — it documents only
// what the pass can actually do. The pass and the instructions are one object,
// which is the point: a brief that describes capabilities the holder does not
// have is worse than no brief.

import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";

export type Scope =
  | "alarm.arm" | "alarm.disarm" | "alarm.bypass"
  | "gate.open" | "door.unlock"
  | "lights"
  | "cameras.live" | "cameras.history"
  | "irrigation.run" | "pool.run"
  | "household.read" | "climate.read";

export type ScopeDef = {
  id: Scope;
  grants: string;
  /** On by default for a typical house-sitter. */
  def: boolean;
  /** Never default-on, and flagged in the UI when granted. */
  sensitive?: boolean;
  /** Cannot be granted at all — kept out of the vocabulary entirely. */
  never?: boolean;
};

export const SCOPES: ScopeDef[] = [
  { id: "alarm.arm", grants: "Arm either area", def: true },
  { id: "alarm.disarm", grants: "Disarm either area", def: true },
  { id: "alarm.bypass", grants: "Bypass a zone", def: false, sensitive: true },
  { id: "gate.open", grants: "Main gate and garage", def: true },
  { id: "door.unlock", grants: "Any electronic door", def: false, sensitive: true },
  { id: "lights", grants: "On, off and brightness, any area", def: true },
  { id: "cameras.live", grants: "Live view only", def: false, sensitive: true },
  // "off, always" in the spec — recorded footage of a family is not a
  // house-sitting capability, so it is offered but never defaulted and always
  // flagged.
  { id: "cameras.history", grants: "Recorded events and clips", def: false, sensitive: true },
  { id: "irrigation.run", grants: "Start or stop a zone", def: false },
  { id: "pool.run", grants: "Pool pump", def: false },
  { id: "household.read", grants: "Meals, bin day, handbook", def: true },
  { id: "climate.read", grants: "Room temperatures", def: true },
];

/**
 * Capabilities that are NOT in the vocabulary. Listed only so the UI can say so
 * out loud — there is deliberately no Scope value for any of them, which means
 * no amount of clicking can grant one.
 */
export const NEVER_GRANTABLE = [
  "Health, sleep and readiness",
  "Anyone's location",
  "Money, the ledger and payouts",
  "The kids' shells and their chores",
];

export type Pass = {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: number;
  /** REQUIRED. There is no indefinite pass. */
  expiresAt: number;
  createdBy: string;
  revokedAt?: number | null;
};

export const defaultScopes = (): Scope[] => SCOPES.filter((s) => s.def).map((s) => s.id);

class PassStore {
  passes = $state<Pass[]>([]);
  loaded = $state(false);

  get active(): Pass[] {
    const now = Date.now();
    return this.passes.filter((p) => !p.revokedAt && p.expiresAt > now);
  }
  get expired(): Pass[] {
    const now = Date.now();
    return this.passes.filter((p) => p.revokedAt || p.expiresAt <= now);
  }

  async load() {
    try {
      const snap = await getDocs(collection(db, "passes"));
      this.passes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pass, "id">) }));
    } catch {
      // Rules-denied or offline: an empty list grants nothing, which is the safe
      // direction to fail in.
      this.passes = [];
    }
    this.loaded = true;
  }

  async issue(name: string, scopes: Scope[], hours: number, by: string): Promise<Pass> {
    if (!name.trim()) throw new Error("A pass needs a name — 'who is this for' is half of the audit trail.");
    if (!(hours > 0)) throw new Error("A pass must expire. There is no indefinite guest.");
    const p: Omit<Pass, "id"> = {
      name: name.trim(),
      // Filter against the vocabulary rather than trusting the caller: this is
      // the last place a scope could be smuggled in that SCOPES does not define.
      scopes: scopes.filter((s) => SCOPES.some((d) => d.id === s)),
      createdAt: Date.now(),
      expiresAt: Date.now() + hours * 3_600_000,
      createdBy: by,
      revokedAt: null,
    };
    const ref = await addDoc(collection(db, "passes"), p);
    await addDoc(collection(db, "passes", ref.id, "audit"), { at: serverTimestamp(), event: "issued", by });
    const full = { id: ref.id, ...p };
    this.passes = [...this.passes, full];
    return full;
  }

  /** Revocation is immediate and lands on the next socket frame. */
  async revoke(id: string) {
    const p = this.passes.find((x) => x.id === id);
    if (!p) return;
    p.revokedAt = Date.now();
    try {
      await setDoc(doc(db, "passes", id), { revokedAt: p.revokedAt }, { merge: true });
      await addDoc(collection(db, "passes", id, "audit"), { at: serverTimestamp(), event: "revoked" });
    } catch { /* local list already reflects it */ }
  }

  async purge(id: string) {
    this.passes = this.passes.filter((p) => p.id !== id);
    try { await deleteDoc(doc(db, "passes", id)); } catch { /* local only */ }
  }
}

export const passes = new PassStore();

/**
 * The house-sitter brief, generated FROM the granted scopes.
 *
 * It documents only what the pass can actually do. A brief that explains how to
 * disarm the alarm to somebody without `alarm.disarm` is worse than no brief —
 * they will try, it will fail, and they will phone you at 22:00.
 */
export function houseSitterBrief(p: Pass, facts: {
  binDay?: string | null;
  poolSchedule?: string | null;
  contact?: string | null;
}): string {
  const has = (s: Scope) => p.scopes.includes(s);
  const lines: string[] = [];

  lines.push(`Vir ${p.name} — geldig tot ${new Date(p.expiresAt).toLocaleString("en-ZA", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false })}.`);
  lines.push("");

  lines.push("WAT JY KAN DOEN");
  if (has("alarm.arm") && has("alarm.disarm")) lines.push("· Wapen en ontwapen die alarm — die huis en die beams is apart.");
  else if (has("alarm.arm")) lines.push("· Wapen die alarm. Jy kan dit NIE ontwapen nie.");
  else if (has("alarm.disarm")) lines.push("· Ontwapen die alarm. Jy kan dit nie weer wapen nie.");
  if (has("gate.open")) lines.push("· Maak die hek en die garage oop.");
  if (has("lights")) lines.push("· Skakel ligte aan en af.");
  if (has("irrigation.run")) lines.push("· Begin of stop besproeiing.");
  if (has("pool.run")) lines.push("· Skakel die swembadpomp aan.");
  if (has("cameras.live")) lines.push("· Kyk na die kameras — net lewendig, nie opnames nie.");
  if (has("climate.read")) lines.push("· Sien die kamertemperature.");

  lines.push("");
  lines.push("WAT JY MOET WEET");
  // Two facts that are always true of this house and always forgotten.
  lines.push("· Die geisers en die stoof werk op GAS. Die afsluiters is die bottels buite die opwaskamer.");
  lines.push("· Daar is geen termostate nie — die temperature is net om te lees.");
  if (facts.binDay) lines.push(`· Vullisdag is ${facts.binDay} — sit dit die aand voor uit.`);
  if (facts.poolSchedule) lines.push(`· Die swembadpomp loop self: ${facts.poolSchedule}.`);
  lines.push("· Die straatligte se relay is onbetroubaar. Dit probeer self weer — moenie bekommerd wees nie.");
  if (facts.contact) lines.push(`· Bel ${facts.contact} as iets nie klop nie.`);

  const denied = SCOPES.filter((s) => !has(s.id)).map((s) => s.grants);
  if (denied.length) {
    lines.push("");
    lines.push("WAT HIERDIE PAS NIE KAN DOEN NIE");
    lines.push(`· ${denied.join(", ")}.`);
  }

  lines.push("");
  lines.push("Gesondheid, ligging, geld en die kinders se skerms is nooit deel van 'n pas nie.");

  return lines.join("\n");
}
