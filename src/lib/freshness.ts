// Freshness as a type — Phase 1.1.
//
// The problem this solves: a dead sensor holding its last value looks identical
// to a live one. On a dashboard you use to decide whether the battery lasts the
// night, that is the most dangerous failure mode in the app. So every read
// carries its own evidence, and a derived figure inherits the worst evidence of
// its inputs plus the id of whatever degraded it.
//
// Three rules from the brief, encoded here rather than left to each view:
//   1. A wrong number is worse than no number — `none` is an em-dash, never 0.
//   2. Staleness NEVER takes an alert colour. Amber means "attention"; a stale
//      reading is absence of evidence, not alarm. It desaturates instead.
//   3. Disconnection is app-level, not per-entity — one bar, not 179 badges.
//      Nothing in this file reports the socket being down; that's App.svelte.

export type FreshState = "live" | "stale" | "none";

export type Reading<T = number | null> = {
  /** null whenever the underlying state is missing/unavailable/unknown. */
  value: T;
  /** epoch ms of the last update, or null if we never had one. */
  at: number | null;
  state: FreshState;
  /** Entity id responsible for a degrade — set on derived readings so the UI
   *  can say "waiting on Victron SoC" rather than just going grey. */
  blame?: string;
  /** Entity id this reading came from (single-entity reads). */
  id?: string;
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------
//
// The real source will be the nightly cadence blob (HA brief B): observed p95
// interval between state changes per entity over 14 days. Until that exists we
// fall back to per-domain defaults, which the brief explicitly allows.
//
// The important subtlety: EVENT-DRIVEN entities are not stale just because
// nothing happened. A switch can legitimately sit untouched for days — its
// staleness signal is `unavailable`, not age. So those get a very generous
// ceiling, and only polled/measured entities get a tight one.

const CLAMP_MIN_MS = 60_000; //   60s floor  (per brief)
const CLAMP_MAX_MS = 93_600_000; // 26h ceiling (per brief)

const DOMAIN_DEFAULT_MS: Record<string, number> = {
  // Measured / polled — a gap here is genuinely suspicious.
  sensor: 30 * 60_000,
  number: 30 * 60_000,
  weather: 2 * 3_600_000,
  camera: 10 * 60_000,
  device_tracker: 2 * 3_600_000,
  person: 2 * 3_600_000,
  // Event-driven — silence is normal, so lean on the ceiling.
  binary_sensor: CLAMP_MAX_MS,
  switch: CLAMP_MAX_MS,
  light: CLAMP_MAX_MS,
  lock: CLAMP_MAX_MS,
  cover: CLAMP_MAX_MS,
  alarm_control_panel: CLAMP_MAX_MS,
  input_boolean: CLAMP_MAX_MS,
  input_number: CLAMP_MAX_MS,
  input_text: CLAMP_MAX_MS,
  input_select: CLAMP_MAX_MS,
  input_datetime: CLAMP_MAX_MS,
  automation: CLAMP_MAX_MS,
  script: CLAMP_MAX_MS,
  button: CLAMP_MAX_MS,
  counter: CLAMP_MAX_MS,
  select: CLAMP_MAX_MS,
  update: CLAMP_MAX_MS,
};

const FALLBACK_MS = 60 * 60_000; // 1h for anything unlisted

/** Cadence blob from HA brief B: entity_id → observed p95 interval in seconds. */
let cadence: Record<string, number> = {};

export function setCadence(blob: Record<string, number>) {
  cadence = blob ?? {};
}

export function hasCadence(): boolean {
  return Object.keys(cadence).length > 0;
}

const clamp = (ms: number) => Math.min(CLAMP_MAX_MS, Math.max(CLAMP_MIN_MS, ms));

/**
 * How long this entity may go without an update before it reads as stale.
 * Cadence blob wins; otherwise the domain default. Always clamped 60s–26h so a
 * pathological observed value can't make an entity permanently stale or
 * permanently trusted.
 */
export function thresholdFor(entityId: string): number {
  const observed = cadence[entityId];
  if (typeof observed === "number" && Number.isFinite(observed) && observed > 0) {
    // p95 is the *normal* worst case, so allow ~2.5× before calling it stale.
    return clamp(observed * 1000 * 2.5);
  }
  const domain = entityId.split(".")[0];
  return clamp(DOMAIN_DEFAULT_MS[domain] ?? FALLBACK_MS);
}

// ---------------------------------------------------------------------------
// Building readings
// ---------------------------------------------------------------------------

const MISSING = new Set(["unavailable", "unknown", "none", ""]);

/** Build a Reading from a raw HA state string + its last-updated timestamp. */
export function toReading(
  id: string,
  rawState: string | undefined,
  lastUpdated: string | number | undefined,
  now = Date.now(),
): Reading<string | null> {
  if (rawState == null || MISSING.has(String(rawState).toLowerCase())) {
    return { value: null, at: null, state: "none", id };
  }
  const at =
    typeof lastUpdated === "number"
      ? lastUpdated
      : lastUpdated
        ? Date.parse(lastUpdated)
        : NaN;
  if (!Number.isFinite(at)) {
    // We have a value but no timestamp — trust the value, don't invent an age.
    return { value: rawState, at: null, state: "live", id };
  }
  const stale = now - at > thresholdFor(id);
  return { value: rawState, at, state: stale ? "stale" : "live", id };
}

/** Numeric variant. A non-numeric state degrades to `none`, never to 0. */
export function toNumReading(
  id: string,
  rawState: string | undefined,
  lastUpdated: string | number | undefined,
  now = Date.now(),
): Reading<number | null> {
  const r = toReading(id, rawState, lastUpdated, now);
  if (r.value == null) return { ...r, value: null };
  const n = Number(r.value);
  if (!Number.isFinite(n)) return { value: null, at: r.at, state: "none", id };
  return { value: n, at: r.at, state: r.state, id };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

const RANK: Record<FreshState, number> = { live: 0, stale: 1, none: 2 };

/**
 * Worst state across inputs, plus the id that caused it.
 *
 * This is the whole point of the type: battery runway is only as trustworthy as
 * the least trustworthy number feeding it, and the UI should be able to say
 * *which* one — "waiting on Victron SoC" — instead of going quietly grey.
 */
export function worst(inputs: Reading<unknown>[]): { state: FreshState; blame?: string } {
  let state: FreshState = "live";
  let blame: string | undefined;
  for (const r of inputs) {
    if (RANK[r.state] > RANK[state]) {
      state = r.state;
      blame = r.blame ?? r.id;
    }
  }
  return { state, blame };
}

/**
 * Compute a derived Reading from inputs. `compute` only runs when every input
 * has a usable value — so a derived figure can never be built from a missing
 * one, which is how "0" bugs get in.
 */
export function derive<T>(
  inputs: Reading<number | null>[],
  compute: (values: number[]) => T,
): Reading<T | null> {
  const { state, blame } = worst(inputs);
  const at = inputs.reduce<number | null>(
    (acc, r) => (r.at != null && (acc == null || r.at < acc) ? r.at : acc),
    null,
  );
  if (inputs.some((r) => r.value == null)) {
    return { value: null, at, state: state === "live" ? "none" : state, blame };
  }
  return { value: compute(inputs.map((r) => r.value as number)), at, state, blame };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Age in words — "14 min old". Deliberately words, not a timestamp. */
export function ageWords(at: number | null, now = Date.now()): string {
  if (at == null) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s old`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min old`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h old`;
  return `${Math.round(h / 24)}d old`;
}

/** One-line explanation for a degraded reading, for tooltips and sheets. */
export function explain(r: Reading<unknown>, friendly?: (id: string) => string): string {
  const name = (id?: string) => (id ? (friendly ? friendly(id) : id) : "an input");
  if (r.state === "live") return "";
  if (r.state === "none") {
    return r.blame ? `No reading — waiting on ${name(r.blame)}` : "No reading";
  }
  return r.blame
    ? `${ageWords(r.at)} — waiting on ${name(r.blame)}`
    : ageWords(r.at);
}
