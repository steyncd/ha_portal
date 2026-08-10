// Load the cadence blob and hand it to freshness. PLATFORM-CONCEPTS §4 / HA brief B.
//
// setCadence() has existed since Phase 1.1 with NO CALLER — the freshness system
// has been running on per-domain defaults the whole time, which is exactly the
// class of gap that showUndo turned out to be. This is the caller.
//
// Cached in localStorage as well as fetched: the blob changes once a night, and
// waiting on a Firestore round trip before the first "14 min old" badge can
// render would mean every cold start briefly shows the wrong threshold.
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { setCadence } from "./freshness";

const KEY = "ha_portal_cadence";

type Blob = { generatedAt: number; cadence: Record<string, number> };

export function loadCachedCadence(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const b = JSON.parse(raw) as Blob;
    // A blob older than a week means the nightly job has stopped. Better to fall
    // back to the domain defaults than to trust thresholds derived from a
    // fortnight that ended some time ago.
    if (!b?.cadence || Date.now() - (b.generatedAt ?? 0) > 7 * 86_400_000) return false;
    setCadence(b.cadence);
    return true;
  } catch {
    return false;
  }
}

export async function refreshCadence(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "config", "cadence"));
    if (!snap.exists()) return 0;
    const b = snap.data() as Blob;
    if (!b?.cadence) return 0;
    setCadence(b.cadence);
    try { localStorage.setItem(KEY, JSON.stringify({ generatedAt: b.generatedAt, cadence: b.cadence })); } catch { /* quota */ }
    return Object.keys(b.cadence).length;
  } catch {
    // Rules-denied or offline: the domain defaults are already in place, which is
    // the safe direction — a missing blob must not make everything look fresh.
    return 0;
  }
}
