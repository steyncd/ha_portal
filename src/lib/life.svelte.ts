// Family "Life" store — shared tasks & chores in Firestore (collection
// `life_tasks`, covered by the members-only catch-all rule). Real-time via
// onSnapshot; kid points accrue when an item is completed.
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

export type Kind = "task" | "chore";
export type LifeItem = {
  id: string;
  title: string;
  kind: Kind;
  assignee: string; // FAMILY key, or "" for anyone
  points: number;
  done: boolean;
  doneAt: number | null;
  due: string | null; // yyyy-mm-dd
  notes: string;
  createdAt: number;
};

// The household. `short` is the avatar initial (colour is never the only channel).
export const FAMILY = [
  { key: "christo", label: "Christo", short: "C" },
  { key: "mandri", label: "Mandri", short: "M" },
  { key: "liam", label: "Liam", short: "L" },
  { key: "eben", label: "Eben", short: "E" },
] as const;

export const familyLabel = (key: string) => FAMILY.find((f) => f.key === key)?.label ?? "Anyone";
export const familyShort = (key: string) => FAMILY.find((f) => f.key === key)?.short ?? "•";

const COL = "life_tasks";

class LifeStore {
  items = $state<LifeItem[]>([]);
  ready = $state(false);
  #unsub: (() => void) | null = null;

  start() {
    if (this.#unsub) return;
    try {
      this.#unsub = onSnapshot(
        collection(db, COL),
        (snap) => {
          this.items = snap.docs
            .map((d) => {
              const x = d.data() as Record<string, any>;
              return {
                id: d.id,
                title: x.title ?? "",
                kind: (x.kind ?? "task") as Kind,
                assignee: x.assignee ?? "",
                points: Number(x.points ?? 0),
                done: !!x.done,
                doneAt: x.doneAt?.toMillis?.() ?? null,
                due: x.due ?? null,
                notes: x.notes ?? "",
                createdAt: x.createdAt?.toMillis?.() ?? 0,
              } as LifeItem;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
          this.ready = true;
        },
        () => { this.ready = true; },
      );
    } catch {
      this.ready = true;
    }
  }

  stop() { this.#unsub?.(); this.#unsub = null; }

  add(i: { title: string; kind: Kind; assignee: string; points: number; due?: string | null; notes?: string }) {
    return addDoc(collection(db, COL), {
      title: i.title,
      kind: i.kind,
      assignee: i.assignee,
      points: i.points,
      due: i.due ?? null,
      notes: i.notes ?? "",
      done: false,
      doneAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  toggle(id: string, done: boolean) {
    return updateDoc(doc(db, COL, id), { done, doneAt: done ? serverTimestamp() : null, updatedAt: serverTimestamp() });
  }

  update(id: string, patch: Partial<LifeItem>) {
    return updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() });
  }

  remove(id: string) { return deleteDoc(doc(db, COL, id)); }

  // "New day": clear the tick on recurring chores so they come round again.
  async resetChores() {
    const done = this.items.filter((i) => i.kind === "chore" && i.done);
    await Promise.all(done.map((c) => this.toggle(c.id, false)));
  }
}

export const life = new LifeStore();
