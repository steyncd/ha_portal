// Lightweight access log — records sign-ins and view-opens to Firestore
// `access_log` so owners can see who signed in and what they looked at.
// Writes must never break the app, so failures are swallowed.
import { db } from "./firebase";
import { authStore } from "./auth.svelte";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";

const COL = () => collection(db, "access_log");
// Dedupe per session so a view is logged once per visit (not on every re-nav).
const seen = new Set<string>();

export async function logAccess(event: "signin" | "view", view?: string) {
  const u = authStore.user;
  if (!u?.email) return;
  if (event === "view") {
    const key = view ?? "";
    if (seen.has(key)) return;
    seen.add(key);
  }
  try {
    await addDoc(COL(), {
      email: u.email.toLowerCase(),
      name: u.displayName ?? "",
      role: authStore.role ?? "?",
      event,
      view: view ?? null,
      ts: serverTimestamp(),
    });
  } catch {
    /* logging is best-effort */
  }
}

export type AccessEvent = { id: string; email: string; name: string; role: string; event: string; view: string | null; ts: number };

/** Subscribe to the most recent access events (owners only, per rules). */
export function subscribeAccessLog(cb: (events: AccessEvent[]) => void, max = 50) {
  try {
    const q = query(COL(), orderBy("ts", "desc"), limit(max));
    return onSnapshot(
      q,
      (snap) =>
        cb(
          snap.docs.map((doc) => {
            const x = doc.data() as Record<string, unknown>;
            return {
              id: doc.id,
              email: (x.email as string) ?? "",
              name: (x.name as string) ?? "",
              role: (x.role as string) ?? "",
              event: (x.event as string) ?? "",
              view: (x.view as string | null) ?? null,
              ts: (x.ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
            };
          }),
        ),
      () => cb([]),
    );
  } catch {
    cb([]);
    return () => {};
  }
}
