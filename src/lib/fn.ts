// The function library. PLATFORM-CONCEPTS §5.
//
// The point is NOT fewer lines. It is that the maths becomes testable and there
// is ONE definition of "self-consumption" — at the moment the same quantity is
// re-derived in several views and in Jinja across 111 packages, which means
// nobody can say what the number in front of them means without reading the view
// that produced it.
//
// Every function here takes nulls seriously. A missing input returns null, never
// 0 — that rule is the whole freshness argument, and it is broken most often in
// arithmetic rather than in rendering: `(a ?? 0) + (b ?? 0)` silently invents a
// number out of two absences.

/** Sum that refuses to invent. Any null input and the answer is unknown. */
export function strictSum(...vals: (number | null | undefined)[]): number | null {
  let total = 0;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) return null;
    total += v;
  }
  return total;
}

/** Mean of the values that exist. Null only when NOTHING exists. */
export function mean(vals: (number | null | undefined)[]): number | null {
  const ok = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

/**
 * Rolling mean over the last `window` samples.
 *
 * Gaps are skipped rather than treated as zero, and a window that ends up with
 * fewer than two real samples returns null instead of a single value dressed up
 * as an average.
 */
export function rollingMean(vals: (number | null | undefined)[], window: number): number | null {
  const slice = vals.slice(-window);
  const ok = slice.filter((v): v is number => v != null && Number.isFinite(v));
  return ok.length >= 2 ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

/**
 * p95, by nearest-rank on the sorted sample.
 *
 * Nearest-rank rather than interpolation on purpose: these are observed
 * intervals and runtimes, and an interpolated p95 is a value that never actually
 * occurred. For "how long does this pump usually run at most", a real
 * observation is the more defensible answer.
 */
export function p95(vals: (number | null | undefined)[]): number | null {
  const ok = vals.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (ok.length < 3) return null; // 2 samples cannot express a 95th percentile
  const idx = Math.min(ok.length - 1, Math.ceil(0.95 * ok.length) - 1);
  return ok[idx];
}

/** Percentile, same nearest-rank rule. */
export function percentile(vals: (number | null | undefined)[], q: number): number | null {
  const ok = vals.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!ok.length) return null;
  const idx = Math.min(ok.length - 1, Math.max(0, Math.ceil(q * ok.length) - 1));
  return ok[idx];
}

/**
 * Overnight delta — the value now minus the value at `hour` last night.
 *
 * This is the shape behind "the tank fell 4% overnight": a change measured
 * across the window when nothing should have been using anything. Returns null
 * if either end is missing, because half of a delta is not a delta.
 */
export function deltaOvernight(
  series: { t: number; v: number | null }[],
  fromHour = 1,
  toHour = 5,
): number | null {
  if (series.length < 2) return null;
  const inWindow = (t: number) => {
    const h = new Date(t).getHours();
    return h >= fromHour && h <= toHour;
  };
  const win = series.filter((p) => p.v != null && inWindow(p.t));
  if (win.length < 2) return null;
  const first = win[0].v!;
  const last = win[win.length - 1].v!;
  return last - first;
}

/** Cost of energy at a tariff. Null in, null out. */
export function costOf(kwh: number | null | undefined, tariff: number | null | undefined): number | null {
  if (kwh == null || tariff == null) return null;
  return kwh * tariff;
}

/**
 * Self-consumption: the share of what the panels made that STAYED in the house.
 *
 * ONE definition, and this is it — produced minus exported, over produced. The
 * common mistake is to compute consumption-over-production, which is a different
 * quantity (that one can exceed 100% whenever the house also draws from the
 * grid) and the two were being used interchangeably.
 */
export function selfConsumption(
  produced: number | null | undefined,
  exported: number | null | undefined,
): number | null {
  if (produced == null || exported == null || produced <= 0) return null;
  return Math.max(0, Math.min(1, (produced - exported) / produced));
}

/** Grid independence: the share of consumption that did not come from the grid. */
export function gridIndependence(
  consumed: number | null | undefined,
  imported: number | null | undefined,
): number | null {
  if (consumed == null || imported == null || consumed <= 0) return null;
  return Math.max(0, Math.min(1, (consumed - imported) / consumed));
}

/**
 * Comfort band. Bands are 14 / 17 / 21.5 / 25 °C, the same five the floor plan
 * and tempColor use — defined once here so a third scale cannot appear.
 */
export type ComfortBand = "cold" | "cool" | "comfortable" | "warm" | "hot";
export function comfortBand(t: number | null | undefined): ComfortBand | null {
  if (t == null || !Number.isFinite(t)) return null;
  if (t < 14) return "cold";
  if (t < 17) return "cool";
  if (t < 21.5) return "comfortable";
  if (t < 25) return "warm";
  return "hot";
}

/**
 * Step change against a baseline — the appliance-drift primitive.
 *
 * Returns the fractional change only when it exceeds `threshold`, so callers do
 * not each re-invent "is this big enough to mention". Deliberately ignores
 * changes below the threshold rather than returning a small number: a drift
 * detector that reports 2% noise is a drift detector nobody reads.
 */
export function stepChange(
  recent: number | null | undefined,
  baseline: number | null | undefined,
  threshold = 0.25,
): number | null {
  if (recent == null || baseline == null || baseline <= 0) return null;
  const change = (recent - baseline) / baseline;
  return Math.abs(change) >= threshold ? change : null;
}

/** Hours between two epoch-ms stamps, or null. */
export function hoursBetween(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return Math.abs(b - a) / 3_600_000;
}

/**
 * Share of a window with no reading, for the "too sparse to chart" rule.
 *
 * Above about a third missing, a line chart misleads BY SHAPE rather than by
 * value, and the honest answer is the Failed state instead of a chart with
 * holes in it.
 */
export function gapFraction(vals: (number | null | undefined)[]): number {
  if (!vals.length) return 1;
  const missing = vals.filter((v) => v == null || !Number.isFinite(v)).length;
  return missing / vals.length;
}

export const TOO_SPARSE = 1 / 3;
