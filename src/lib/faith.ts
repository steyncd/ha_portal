// Firestore-backed prayer list (the "living Gebedslys") + kids' memory verses.
// Household-scoped (rules: members read/write). Prayers track the days they were
// prayed (for a streak) and can be marked answered with a date.
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";

export type Prayer = {
  id: string;
  text: string;
  category?: string;
  answered?: boolean;
  answeredAt?: number | null;
  prayedDates?: string[]; // YYYY-MM-DD (SAST)
  ts?: number;
};

export type MemoryVerse = { ref: string; text: string; status: "learning" | "reviewing" | "known" };
export type MemoryDoc = Record<string, MemoryVerse>; // keyed by child slug

const todayKey = () => {
  const s = new Date(Date.now() + 2 * 3600_000); // SAST
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
};

// Consecutive-day streak ending today or yesterday.
export function streak(dates: string[] = []): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const day = (offset: number) => {
    const s = new Date(Date.now() + 2 * 3600_000 - offset * 86400_000);
    return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
  };
  let start = set.has(day(0)) ? 0 : set.has(day(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (set.has(day(start + n))) n++;
  return n;
}
export const prayedToday = (p: Prayer) => (p.prayedDates ?? []).includes(todayKey());

export function watchPrayers(cb: (p: Prayer[]) => void) {
  return onSnapshot(collection(db, "prayers"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Prayer, "id">) })));
  });
}

export async function addPrayer(text: string, category = "") {
  const t = text.trim();
  if (!t) throw new Error("Enter a prayer request");
  await addDoc(collection(db, "prayers"), {
    text: t, category: category.trim(), answered: false, answeredAt: null,
    prayedDates: [], addedBy: auth.currentUser?.email ?? null, ts: Date.now(),
  });
}

export async function togglePrayedToday(p: Prayer) {
  const k = todayKey();
  const dates = new Set(p.prayedDates ?? []);
  if (dates.has(k)) dates.delete(k); else dates.add(k);
  await updateDoc(doc(db, "prayers", p.id), { prayedDates: [...dates] });
}

export async function setAnswered(id: string, answered: boolean) {
  await updateDoc(doc(db, "prayers", id), { answered, answeredAt: answered ? Date.now() : null });
}

export const removePrayer = (id: string) => deleteDoc(doc(db, "prayers", id));

// ---- memory verses (single doc keyed by child) ----
export function watchMemory(cb: (m: MemoryDoc) => void) {
  return onSnapshot(doc(db, "faith", "memoryVerses"), (snap) => cb((snap.data() as MemoryDoc) ?? {}));
}
export async function setMemory(child: string, v: MemoryVerse) {
  await setDoc(doc(db, "faith", "memoryVerses"), { [child]: v }, { merge: true });
}

// ---- gratitude journal ----
export type Gratitude = { id: string; who: string; text: string; date: string; ts?: number };
export function watchGratitude(cb: (g: Gratitude[]) => void) {
  return onSnapshot(collection(db, "gratitude"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Gratitude, "id">) })).sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))),
  );
}
export async function addGratitude(who: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const s = new Date(Date.now() + 2 * 3600_000);
  const date = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
  await addDoc(collection(db, "gratitude"), { who, text: t, date, by: auth.currentUser?.email ?? null, ts: Date.now() });
}
export const gratitudeTodayKey = () => {
  const s = new Date(Date.now() + 2 * 3600_000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
};
