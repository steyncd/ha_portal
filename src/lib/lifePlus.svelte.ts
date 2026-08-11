// Phase-2 "Life OS" stores: bills & subscriptions, shopping list, weekly meal
// plan — all Firestore-backed (members-only catch-all rule) + real-time.
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
// Pure date/bill math lives in lifeCalc (Firebase-free, unit-tested); re-exported
// here so existing importers (Life.svelte) keep the same import surface.
import { monthKey, dueInDays } from "./lifeCalc";
export { monthKey, dueInDays } from "./lifeCalc";

// ---------- Bills & subscriptions ----------
export type Bill = {
  id: string; name: string; amount: number; dueDay: number; category: string;
  paidMonth: string; autopay: boolean; createdAt: number;
};

class BillsStore {
  items = $state<Bill[]>([]);
  ready = $state(false);
  #unsub: (() => void) | null = null;
  start() {
    if (this.#unsub) return;
    this.#unsub = onSnapshot(collection(db, "life_bills"), (snap) => {
      this.items = snap.docs.map((d) => {
        const x = d.data() as Record<string, any>;
        return { id: d.id, name: x.name ?? "", amount: Number(x.amount ?? 0), dueDay: Number(x.dueDay ?? 1),
          category: x.category ?? "", paidMonth: x.paidMonth ?? "", autopay: !!x.autopay,
          createdAt: x.createdAt?.toMillis?.() ?? 0 } as Bill;
      }).sort((a, b) => dueInDays(a.dueDay) - dueInDays(b.dueDay));
      this.ready = true;
    }, () => { this.ready = true; });
  }
  stop() { this.#unsub?.(); this.#unsub = null; }
  add(b: { name: string; amount: number; dueDay: number; category: string; autopay: boolean }) {
    return addDoc(collection(db, "life_bills"), { ...b, paidMonth: "", createdAt: serverTimestamp() });
  }
  markPaid(id: string, paid: boolean) { return updateDoc(doc(db, "life_bills", id), { paidMonth: paid ? monthKey() : "" }); }
  remove(id: string) { return deleteDoc(doc(db, "life_bills", id)); }
}

// ---------- Shopping list ----------
export type ShopItem = { id: string; item: string; qty: string; checked: boolean; createdAt: number };

class ShopStore {
  items = $state<ShopItem[]>([]);
  ready = $state(false);
  #unsub: (() => void) | null = null;
  start() {
    if (this.#unsub) return;
    this.#unsub = onSnapshot(collection(db, "life_shopping"), (snap) => {
      this.items = snap.docs.map((d) => {
        const x = d.data() as Record<string, any>;
        return { id: d.id, item: x.item ?? "", qty: x.qty ?? "", checked: !!x.checked, createdAt: x.createdAt?.toMillis?.() ?? 0 } as ShopItem;
      }).sort((a, b) => Number(a.checked) - Number(b.checked) || b.createdAt - a.createdAt);
      this.ready = true;
    }, () => { this.ready = true; });
  }
  stop() { this.#unsub?.(); this.#unsub = null; }
  add(item: string, qty = "") { return addDoc(collection(db, "life_shopping"), { item, qty, checked: false, createdAt: serverTimestamp() }); }
  toggle(id: string, checked: boolean) { return updateDoc(doc(db, "life_shopping", id), { checked }); }
  remove(id: string) { return deleteDoc(doc(db, "life_shopping", id)); }
  async clearChecked() {
    const done = this.items.filter((i) => i.checked);
    if (!done.length) return;
    const batch = writeBatch(db);
    done.forEach((i) => batch.delete(doc(db, "life_shopping", i.id)));
    await batch.commit();
  }
}

// ---------- Weekly meal plan (single doc) ----------
export const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
] as const;

class MealsStore {
  data = $state<Record<string, string>>({});
  ready = $state(false);
  #unsub: (() => void) | null = null;
  start() {
    if (this.#unsub) return;
    this.#unsub = onSnapshot(doc(db, "life_meals", "current"), (snap) => { this.data = (snap.data() as Record<string, string>) ?? {}; this.ready = true; }, () => { this.ready = true; });
  }
  stop() { this.#unsub?.(); this.#unsub = null; }
  set(day: string, meal: string) { return setDoc(doc(db, "life_meals", "current"), { [day]: meal }, { merge: true }); }
}

// ---------- Auto-journal (read-only; written nightly by the journalDaily fn) ----------
export type JournalEntry = { id: string; date: string; text: string };

class JournalStore {
  items = $state<JournalEntry[]>([]);
  ready = $state(false);
  #unsub: (() => void) | null = null;
  start() {
    if (this.#unsub) return;
    this.#unsub = onSnapshot(collection(db, "life_journal"), (snap) => {
      this.items = snap.docs
        .map((d) => { const x = d.data() as Record<string, any>; return { id: d.id, date: x.date ?? d.id, text: x.text ?? "" } as JournalEntry; })
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      this.ready = true;
    }, () => { this.ready = true; });
  }
  stop() { this.#unsub?.(); this.#unsub = null; }
}

export const bills = new BillsStore();
export const shopping = new ShopStore();
export const meals = new MealsStore();
export const journal = new JournalStore();
