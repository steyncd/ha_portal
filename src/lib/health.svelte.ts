// health/latest — the machinery half of staleness. Cloud review §2.2.
//
// Written by healthProbe (every 5 min) and by monitoringHook (Cloud Monitoring
// alerts). Read here so that "HA unreachable for 15 minutes" and "refreshParcels
// has failed 12 times" render in the SAME list as a stale sensor, in the same
// blue/amber-with-glyphs treatment. One health story, not three.
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export type Incident = { open: boolean; since?: number; resolvedAt?: number; summary?: string };
export type Health = {
  at?: number;
  ha?: { ok: boolean; status: number; latencyMs: number; consecutiveFails: number };
  incidents?: Record<string, Incident>;
};

class HealthStore {
  data = $state<Health>({});
  /** True once we have heard from Firestore at all — absence is not health. */
  loaded = $state(false);

  start(): () => void {
    try {
      return onSnapshot(
        doc(db, "health", "latest"),
        (snap) => {
          this.data = (snap.data() as Health) ?? {};
          this.loaded = true;
        },
        () => { this.loaded = true; },
      );
    } catch {
      this.loaded = true;
      return () => {};
    }
  }

  /** Open incidents, newest first. */
  get openIncidents(): { name: string; since: number; summary: string }[] {
    const inc = this.data.incidents ?? {};
    return Object.entries(inc)
      .filter(([, v]) => v?.open)
      .map(([name, v]) => ({ name: name.replace(/_/g, " "), since: v.since ?? 0, summary: v.summary ?? "" }))
      .sort((a, b) => b.since - a.since);
  }

  /**
   * Is HA answering? Null when we genuinely do not know — which is different
   * from "no", and rendering it as "no" would be the same lie the whole
   * freshness argument is against.
   */
  get haReachable(): boolean | null {
    if (!this.loaded || !this.data.ha) return null;
    // One missed probe is a flaky link; three is the house off the internet.
    return this.data.ha.consecutiveFails < 3;
  }

  get probeAge(): number | null {
    return this.data.at ? Date.now() - this.data.at : null;
  }
}

export const health = new HealthStore();
