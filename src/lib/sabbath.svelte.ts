// Sabbath mode — a household-shared flag (Firestore settings/sabbath) that, when
// on, quietens the "work/admin" corners of the portal so Sunday can breathe.
// App.svelte reads `sabbath.on` to dim those nav items; the Faith view toggles it.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Views hidden from the sidebar while Sabbath mode is on (work, admin, money).
export const SABBATH_HIDDEN = ["trello", "markets", "insights", "fairplay", "meals", "kids", "traffic", "powertrends"];

class Sabbath {
  on = $state(false);
  #started = false;

  start() {
    if (this.#started) return;
    this.#started = true;
    try { onSnapshot(doc(db, "settings", "sabbath"), (s) => { this.on = !!(s.data()?.on); }); } catch { /* offline */ }
  }
  async set(v: boolean) {
    this.on = v; // optimistic
    try { await setDoc(doc(db, "settings", "sabbath"), { on: v, ts: Date.now() }, { merge: true }); } catch { /* mock/offline */ }
  }
  toggle() { return this.set(!this.on); }
}

export const sabbath = new Sabbath();
