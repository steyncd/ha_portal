// Proactive anomaly nudges — the client half of the `anomalyNudges` Function.
//
// The backend hands Gemini a contextual snapshot of the house and asks "is
// anything worth interrupting a person about?", then a deterministic gate
// decides what's allowed to surface (confidence floor, cooldown, quiet hours,
// daily cap). Whatever survives lands in Firestore `nudges` and shows up here
// as a card with a one-tap action, alongside the FCM push.

import { db } from "./firebase";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";

export type Nudge = {
  id: string;
  key: string;
  title: string;
  body: string;
  view: string;
  urgent: boolean;
  confidence: number;
  ts: number;
};

/**
 * Subscribe to undismissed nudges from the last 24h, newest first.
 * Fails soft — a rules error or offline client just yields an empty list
 * rather than breaking the Home surface.
 */
export function subscribeNudges(cb: (items: Nudge[]) => void, max = 3) {
  try {
    const cutoff = Date.now() - 86_400_000;
    const q = query(
      collection(db, "nudges"),
      where("dismissed", "==", false),
      orderBy("ts", "desc"),
      limit(20),
    );
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              key: (x.key as string) ?? "",
              title: (x.title as string) ?? "",
              body: (x.body as string) ?? "",
              view: (x.view as string) ?? "home",
              urgent: (x.urgent as boolean) ?? false,
              confidence: (x.confidence as number) ?? 0,
              ts: (x.ts as number) ?? 0,
            };
          })
          .filter((nd) => nd.ts >= cutoff)
          .slice(0, max);
        cb(items);
      },
      () => cb([]),
    );
  } catch {
    cb([]);
    return () => {};
  }
}

/** Mark a nudge handled so it stops showing (and stops re-pushing on cooldown). */
export async function dismissNudge(id: string) {
  try {
    await updateDoc(doc(db, "nudges", id), { dismissed: true, dismissedAt: Date.now() });
  } catch {
    /* best-effort */
  }
}
