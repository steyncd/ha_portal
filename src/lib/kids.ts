// Kids' routines + chores + allowance (Firestore-backed, household-scoped).
//
// Model: paid chores accrue Rand into a running `balance` that carries across
// days until an owner "pays out"; the per-day `choresDone` / `routineDone` lists
// reset each new day so the boys earn afresh. Payouts are recorded in
// `kids_payouts`; posting into the Steyn Finance project is done server-side.
import { collection, addDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";

export type Kid = { slug: string; name: string; age: number; icon: string; color: string };
export const KIDS: Kid[] = [
  { slug: "liam", name: "Liam", age: 11, icon: "🧒", color: "var(--water)" },
  { slug: "eben", name: "Eben", age: 8, icon: "👦", color: "var(--warning)" },
];

// rand = 0 → unpaid "family contribution"; rand > 0 → a paid extra job.
export type Chore = { id: string; label: string; icon: string; rand: number };
export const CHORES: Chore[] = [
  { id: "bed", label: "Make bed", icon: "🛏️", rand: 0 },
  { id: "homework", label: "Homework", icon: "📚", rand: 0 },
  { id: "clothes", label: "Clothes in wash", icon: "🧺", rand: 0 },
  { id: "pets", label: "Feed the pets", icon: "🐾", rand: 5 },
  { id: "table", label: "Set the table", icon: "🍴", rand: 3 },
  { id: "dishes", label: "Help with dishes", icon: "🍽️", rand: 5 },
  { id: "tidyroom", label: "Tidy room", icon: "🧹", rand: 5 },
  { id: "trash", label: "Take out trash", icon: "🗑️", rand: 10 },
  { id: "garden", label: "Help in garden", icon: "🌿", rand: 10 },
];

export type RoutineItem = { id: string; label: string; icon: string; period: "morning" | "evening" };
export const ROUTINE: RoutineItem[] = [
  { id: "m_wake", label: "Wake up & greet the day", icon: "🌅", period: "morning" },
  { id: "m_dress", label: "Get dressed", icon: "👕", period: "morning" },
  { id: "m_teeth", label: "Brush teeth", icon: "🪥", period: "morning" },
  { id: "m_break", label: "Eat breakfast", icon: "🥣", period: "morning" },
  { id: "m_bag", label: "Pack school bag", icon: "🎒", period: "morning" },
  { id: "e_home", label: "Homework done", icon: "✏️", period: "evening" },
  { id: "e_tidy", label: "Tidy up toys", icon: "🧸", period: "evening" },
  { id: "e_bath", label: "Bath & pyjamas", icon: "🛁", period: "evening" },
  { id: "e_teeth", label: "Brush teeth", icon: "🪥", period: "evening" },
  { id: "e_read", label: "Reading & prayer", icon: "📖", period: "evening" },
];

export type KidState = {
  balance?: number;        // Rand accrued since last payout
  paidTotal?: number;      // lifetime Rand earned
  todayDate?: string;      // YYYY-MM-DD (SAST) the day lists belong to
  choresDone?: string[];
  routineDone?: string[];
  lastPayout?: number;
};

export function todayKey(): string {
  const s = new Date(Date.now() + 2 * 3600_000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
}
// Lists reset each new day; balance persists.
export const choresToday = (s: KidState) => (s.todayDate === todayKey() ? s.choresDone ?? [] : []);
export const routineToday = (s: KidState) => (s.todayDate === todayKey() ? s.routineDone ?? [] : []);

export function watchKid(slug: string, cb: (s: KidState) => void) {
  return onSnapshot(doc(db, "kids", slug), (snap) => cb((snap.data() as KidState) ?? {}));
}

export async function toggleChore(slug: string, s: KidState, chore: Chore) {
  const done = choresToday(s);
  const has = done.includes(chore.id);
  const nextDone = has ? done.filter((x) => x !== chore.id) : [...done, chore.id];
  const delta = has ? -chore.rand : chore.rand;
  await setDoc(doc(db, "kids", slug), {
    todayDate: todayKey(),
    choresDone: nextDone,
    balance: Math.max(0, (s.balance ?? 0) + delta),
    paidTotal: (s.paidTotal ?? 0) + Math.max(0, delta),
    routineDone: routineToday(s),
  }, { merge: true });
}

export async function toggleRoutine(slug: string, s: KidState, itemId: string) {
  const done = routineToday(s);
  const has = done.includes(itemId);
  await setDoc(doc(db, "kids", slug), {
    todayDate: todayKey(),
    routineDone: has ? done.filter((x) => x !== itemId) : [...done, itemId],
    choresDone: choresToday(s),
  }, { merge: true });
}

// Bank the balance: record the payout and reset. Server posts it to Steyn Finance.
export async function payout(slug: string, s: KidState) {
  const amount = s.balance ?? 0;
  if (amount <= 0) return { amount: 0 };
  await addDoc(collection(db, "kids_payouts"), { slug, amount, by: auth.currentUser?.email ?? null, ts: Date.now(), posted: false });
  await setDoc(doc(db, "kids", slug), { balance: 0, lastPayout: Date.now() }, { merge: true });
  // Fire-and-forget: post into the finance project (best-effort).
  try {
    const t = await auth.currentUser?.getIdToken();
    await fetch("/api/kid-payout", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ slug, amount }) });
  } catch { /* recorded locally regardless */ }
  return { amount };
}
