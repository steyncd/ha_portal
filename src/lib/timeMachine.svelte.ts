// Time machine — scrub the whole dashboard back through history.
//
// Design note on why this is a store of plain state with no fetching in it:
// the fetch lives on the HA store (`ha.timeTravel`), so the dependency runs one
// way only (store → timeMachine) and there's no import cycle.
//
// The clever part isn't here, it's in store.svelte.ts: `state()`, `num()`,
// `isOn()` and friends read from `snapshot` when this is active. That means
// every view in the app time-travels without a single line changed in any of
// them — a card that renders `ha.num(E.batterySoc)` shows the historical value
// automatically.
//
// Writes are blocked while active (see HAStore.#svc). Looking at 14:00 and
// tapping a light must not switch anything now.

import { E, ROOMS, LIGHT_AREAS, APPLIANCES, PUMPS } from "./entities";

/**
 * The entities we pull history for. Deliberately curated rather than "all of
 * them": ~5,000 entities would be an abusive query and almost none of it is
 * ever rendered. This covers everything the dashboards actually show.
 * (entities.ts imports nothing, so there's no cycle back to the HA store.)
 */
export const TM_IDS: string[] = [...new Set<string>([
  ...(Object.values(E) as string[]).filter((v) => typeof v === "string" && v.includes(".")),
  ...ROOMS.map((r) => r.id),
  ...ROOMS.map((r) => r.humidity).filter((x): x is string => !!x),
  ...LIGHT_AREAS.flatMap((a) => a.lights.map((l) => l.id)),
  ...APPLIANCES.flatMap((a) => [a.sw, a.power]),
  ...PUMPS.flatMap((p) => [p.sw, p.power, p.flow].filter((x): x is string => !!x)),
])];

export type TMState = {
  active: boolean;
  /** epoch ms being viewed */
  at: number;
  /** entity_id → state string, as of `at` */
  snapshot: Record<string, string>;
  loading: boolean;
  error: string;
  /** how far back the scrubber can reach, in hours */
  windowH: number;
};

class TimeMachine {
  active = $state(false);
  at = $state(Date.now());
  snapshot = $state.raw<Record<string, string>>({});
  loading = $state(false);
  error = $state("");
  windowH = $state(24);

  /** Start of the scrubbable range. */
  get from(): number {
    return Date.now() - this.windowH * 3_600_000;
  }

  /** 0–1 position of `at` within the window, for the slider. */
  get pos(): number {
    const span = Date.now() - this.from;
    return span <= 0 ? 1 : Math.min(1, Math.max(0, (this.at - this.from) / span));
  }

  /** Human label for the moment being viewed. */
  get label(): string {
    const d = new Date(this.at);
    const mins = Math.round((Date.now() - this.at) / 60000);
    const rel =
      mins < 1 ? "now" :
      mins < 60 ? `${mins} min ago` :
      mins < 60 * 24 ? `${Math.round(mins / 60)} h ago` :
      `${Math.round(mins / 1440)} d ago`;
    return `${d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${rel}`;
  }

  reset() {
    this.active = false;
    this.snapshot = {};
    this.error = "";
    this.loading = false;
    this.at = Date.now();
  }
}

export const timeMachine = new TimeMachine();
