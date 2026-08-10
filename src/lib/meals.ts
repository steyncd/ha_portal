// Firestore-backed weekly meal plan + shared shopping list (household-scoped).
// The plan is a single doc keyed by weekday; the shopping list is a collection.
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc, getDocs, writeBatch } from "firebase/firestore";
import { db, auth } from "./firebase";

export type MealPlan = Record<string, { dinner?: string }>; // keyed by mon..sun
export type ShoppingItem = { id: string; text: string; done?: boolean; ts?: number };

export const DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

// Today's weekday key in SAST (getDay: 0=Sun..6=Sat).
export function todayKey(): string {
  const s = new Date(Date.now() + 2 * 3600_000);
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[s.getUTCDay()];
}

export function watchMealPlan(cb: (p: MealPlan) => void) {
  return onSnapshot(doc(db, "meals", "plan"), (snap) => cb((snap.data() as MealPlan) ?? {}));
}
export async function setMeal(day: string, dinner: string) {
  await setDoc(doc(db, "meals", "plan"), { [day]: { dinner: dinner.trim() } }, { merge: true });
}

export function watchShopping(cb: (items: ShoppingItem[]) => void) {
  return onSnapshot(collection(db, "shopping"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShoppingItem, "id">) })).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))),
  );
}
export async function addShopping(text: string) {
  const t = text.trim();
  if (!t) return;
  await addDoc(collection(db, "shopping"), { text: t, done: false, addedBy: auth.currentUser?.email ?? null, ts: Date.now() });
}
export const toggleShopping = (id: string, done: boolean) => updateDoc(doc(db, "shopping", id), { done });
export const removeShopping = (id: string) => deleteDoc(doc(db, "shopping", id));
export async function clearDoneShopping() {
  const snap = await getDocs(collection(db, "shopping"));
  const batch = writeBatch(db);
  snap.docs.filter((d) => (d.data() as ShoppingItem).done).forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
