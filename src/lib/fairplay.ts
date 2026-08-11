// Fair Play "who owns this" — recurring household responsibilities, each owned
// end-to-end (conception + planning + execution) by one person to an agreed
// minimum standard. Firestore-backed; the view surfaces the ownership balance
// so the mental load is visible, not just felt.
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { db, auth } from "./firebase";

export type Owner = "Christo" | "Mandri" | "Shared";
export const OWNERS: Owner[] = ["Christo", "Mandri", "Shared"];
export type Cadence = "daily" | "weekly" | "monthly" | "seasonal" | "as-needed";
export const CADENCES: Cadence[] = ["daily", "weekly", "monthly", "seasonal", "as-needed"];

export type Responsibility = {
  id: string;
  title: string;
  owner: Owner;
  standard?: string; // the agreed "minimum standard of care"
  cadence?: Cadence;
  area?: string;
  ts?: number;
};

export function watchResponsibilities(cb: (r: Responsibility[]) => void) {
  return onSnapshot(collection(db, "responsibilities"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Responsibility, "id">) })).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))),
  );
}
export async function addResponsibility(r: Omit<Responsibility, "id" | "ts">) {
  await addDoc(collection(db, "responsibilities"), { ...r, addedBy: auth.currentUser?.email ?? null, ts: Date.now() });
}
export const updateResponsibility = (id: string, patch: Partial<Responsibility>) => updateDoc(doc(db, "responsibilities", id), patch);
export const removeResponsibility = (id: string) => deleteDoc(doc(db, "responsibilities", id));

// A sensible starter set for a young family — seeded on demand.
export const STARTER: Omit<Responsibility, "id" | "ts">[] = [
  { title: "Meal planning & groceries", owner: "Shared", cadence: "weekly", standard: "Plan the week's dinners; list ready before the shop", area: "Kitchen" },
  { title: "School admin & communication", owner: "Mandri", cadence: "daily", standard: "Read the school app; diarise every date the day it lands", area: "Kids" },
  { title: "Bills & accounts", owner: "Christo", cadence: "monthly", standard: "Everything paid before due date; nothing in arrears", area: "Admin" },
  { title: "Kids' bedtime routine", owner: "Shared", cadence: "daily", standard: "Bath, teeth, reading & prayer done by 19:30", area: "Kids" },
  { title: "Morning school run", owner: "Christo", cadence: "daily", standard: "Boys fed, packed and dropped on time", area: "Kids" },
  { title: "Laundry", owner: "Mandri", cadence: "weekly", standard: "Washed, dried and put away — not left in baskets", area: "Home" },
  { title: "Family devotions", owner: "Christo", cadence: "daily", standard: "A verse + prayer together most evenings", area: "Faith" },
  { title: "Home & garden maintenance", owner: "Christo", cadence: "seasonal", standard: "Pool, borehole, irrigation & repairs kept ahead of failure", area: "Home" },
  { title: "Birthdays & gifts", owner: "Mandri", cadence: "monthly", standard: "Nobody's occasion is forgotten; gift sorted a week ahead", area: "Admin" },
  { title: "Medical & appointments", owner: "Mandri", cadence: "as-needed", standard: "Booked, diarised, and everyone reminded", area: "Admin" },
];

export async function seedStarter() {
  const batch = writeBatch(db);
  STARTER.forEach((r) => {
    const ref = doc(collection(db, "responsibilities"));
    batch.set(ref, { ...r, addedBy: auth.currentUser?.email ?? null, ts: Date.now() });
  });
  await batch.commit();
}
