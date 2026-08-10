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

// Local mirror of the connection config.
//
// This exists for one specific failure that used to break the whole app: the
// boot path awaited a Firestore read for the HA token, and Firestore's default
// cache is memory-only. When the WAN is down but the LAN is fine — a power
// outage, a fibre fault — that read would hang, and the portal could not reach
// Home Assistant *even though HA was sitting on the same network, reachable*.
// The one moment you most want the dashboard is the moment it failed.
//
// So: read the cache first and return instantly, then refresh from Firestore in
// the background. Boot never blocks on the internet.
const CACHE_KEY = "ha_portal_haconn";
const FIRESTORE_TIMEOUT_MS = 4000;

function readCache(): HaConnConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<HaConnConfig>;
    return d.url && d.token ? { url: d.url, token: d.token } : null;
  } catch {
    return null;
  }
}

function writeCache(cfg: HaConnConfig | null) {
  try {
    if (cfg) localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* private mode / quota — cache is an optimisation, never required */
  }
}

/** Fetch from Firestore, but never hang: resolves null if the cloud is slow or gone. */
async function fetchRemote(): Promise<HaConnConfig | null> {
  try {
    const snap = await Promise.race([
      getDoc(doc(db, "settings", "haConnection")),
      new Promise<null>((r) => setTimeout(() => r(null), FIRESTORE_TIMEOUT_MS)),
    ]);
    if (snap && "exists" in snap && snap.exists()) {
      const d = snap.data() as Partial<HaConnConfig>;
      if (d.url && d.token) return { url: d.url, token: d.token };
    }
  } catch {
    /* offline / not configured / no access — caller falls back */
  }
  return null;
}

/**
 * Load the stored HA connection, or null if none is configured yet.
 *
 * Returns the cached value immediately when there is one, and refreshes from
 * Firestore in the background so a token rotated on another device is picked up
 * on the next load. With no cache it still waits for Firestore, but bounded.
 */
export async function loadHaConnection(): Promise<HaConnConfig | null> {
  const cached = readCache();
  if (cached) {
    // Don't await — a dead WAN must not delay the HA connection.
    void fetchRemote().then((fresh) => {
      if (fresh && (fresh.url !== cached.url || fresh.token !== cached.token)) writeCache(fresh);
    });
    return cached;
  }
  const fresh = await fetchRemote();
  if (fresh) writeCache(fresh);
  return fresh;
}

/** Persist the HA connection for future sessions / other devices. */
export async function saveHaConnection(cfg: HaConnConfig): Promise<void> {
  writeCache(cfg);
  await setDoc(doc(db, "settings", "haConnection"), cfg);
}

/** Remove the stored direct connection — the portal reverts to the built-in
 *  (Nabu Casa) URL via the interactive OAuth flow on the next load. */
export async function clearHaConnection(): Promise<void> {
  writeCache(null);
  await deleteDoc(doc(db, "settings", "haConnection"));
}
