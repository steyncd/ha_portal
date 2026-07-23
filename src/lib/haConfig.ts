// Stored Home Assistant connection (URL + long-lived access token).
//
// After Google sign-in, the portal reads this doc from Firestore and connects
// to HA with the stored long-lived token — no interactive HA OAuth dance. The
// token is entered once in Settings and lives in Firestore, gated by the
// security rules to signed-in household members.
//
// Security note: a long-lived HA token grants full control of the home. It is
// stored gated in Firestore and only reaches the browser of an authorised,
// signed-in user (the live WebSocket is necessarily client-side). Acceptable
// for a personal/family dashboard behind Google login.
import { db } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

export type HaConnConfig = { url: string; token: string };

/** Load the stored HA connection, or null if none is configured yet. */
export async function loadHaConnection(): Promise<HaConnConfig | null> {
  try {
    const snap = await getDoc(doc(db, "settings", "haConnection"));
    if (snap.exists()) {
      const d = snap.data() as Partial<HaConnConfig>;
      if (d.url && d.token) return { url: d.url, token: d.token };
    }
  } catch {
    /* not configured / no access — caller falls back to HA OAuth */
  }
  return null;
}

/** Persist the HA connection for future sessions / other devices. */
export async function saveHaConnection(cfg: HaConnConfig): Promise<void> {
  await setDoc(doc(db, "settings", "haConnection"), cfg);
}

/** Remove the stored direct connection — the portal reverts to the built-in
 *  (Nabu Casa) URL via the interactive OAuth flow on the next load. */
export async function clearHaConnection(): Promise<void> {
  await deleteDoc(doc(db, "settings", "haConnection"));
}
