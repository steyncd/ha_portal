// Retrospective trend analysis over Long-Term Statistics series.
// Given a numeric series (one point per period), work out: where it sits now vs
// its own baseline, which way it's moving, how strong/steady the move is, and
// turn that into a ranked, plain-language finding.

export type StatPoint = { t: number; mean: number | null; min: number | null; max: number | null; sum: number | null; change: number | null };
export type Series = { t: number; v: number }[];

/** Which field to read for a metric, and how to phrase movement. */
export type Pick = "mean" | "change" | "sum" | "max";

export type MetricDef = {
  key: string;
  label: string;
  stat: string; // statistic_id (usually the entity_id)
  unit: string;
  pick?: Pick; // default "mean"
  period?: "hour" | "day" | "week" | "month"; // default "day"
  days?: number; // look-back, default 90
  /** Is a rising value good? efficiency ↑ good; phantom load / cost ↑ bad; null = neutral. */
  goodUp?: boolean | null;
  digits?: number;
  /** Minimum |Δ%| vs baseline to bother reporting. Default 6. */
  minPct?: number;
  domain: "energy" | "water" | "traffic" | "security";
};

export type Trend = {
  def: MetricDef;
  series: Series;
  current: number;
  baseline: number;
  deltaPct: number; // recent vs baseline
  slopePerWeek: number; // regression slope, per 7 days, in %
  direction: "up" | "down" | "flat";
  streak: number; // consecutive most-recent periods on the same side of baseline
  severity: number; // 0..1 ranking weight
  good: boolean | null; // is the movement good?
  headline: string;
  detail: string;
};

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** Extract the chosen numeric field into a clean {t,v} series. */
export function toSeries(pts: StatPoint[], pick: Pick = "mean"): Series {
  const out: Series = [];
  for (const p of pts) {
    let v = p[pick];
    if (v == null) v = p.mean ?? p.change ?? p.sum ?? p.max;
    if (v != null && Number.isFinite(v)) out.push({ t: p.t, v });
  }
  return out;
}

/** Least-squares slope (v per ms). */
function regressionSlope(s: Series): number {
  const n = s.length;
  if (n < 3) return 0;
  const mx = mean(s.map((p) => p.t));
  const my = mean(s.map((p) => p.v));
  let num = 0, den = 0;
  for (const p of s) {
    num += (p.t - mx) * (p.v - my);
    den += (p.t - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

const fmtPct = (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`;

// Build a Trend from a current + baseline value. `series` drives the sparkline,
// slope and streak (may be empty). `baselineDesc` labels the baseline in prose.
function finalize(def: MetricDef, current: number, baseline: number, series: Series, baselineDesc: string): Trend | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null;
  const period = def.period ?? "day";
  const perMs = period === "hour" ? 3_600_000 : period === "week" ? 7 * 86_400_000 : period === "month" ? 30 * 86_400_000 : 86_400_000;

  const deltaPct = ((current - baseline) / Math.abs(baseline)) * 100;
  const slopePerWeek = series.length >= 3 ? (regressionSlope(series) * 7 * 86_400_000) / Math.abs(baseline) * 100 : 0;

  const minPct = def.minPct ?? 6;
  const direction = deltaPct > minPct ? "up" : deltaPct < -minPct ? "down" : "flat";

  // streak: consecutive most-recent points on the same side of baseline
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (i === series.length - 1) streak = 1;
    else if ((series[i].v >= baseline) === (series[series.length - 1].v >= baseline)) streak++;
    else break;
  }
  const streakDays = Math.round((streak * perMs) / 86_400_000);

  const good = def.goodUp == null ? null : direction === "flat" ? null : (direction === "up") === def.goodUp;
  const severity = Math.min(1, (Math.abs(deltaPct) / 40) * 0.7 + (Math.min(Math.abs(slopePerWeek), 20) / 20) * 0.3) * (direction === "flat" ? 0.25 : 1);

  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const dirWord = direction === "flat" ? "steady" : direction;
  const headline = `${def.label} ${dirWord}${direction === "flat" ? "" : " " + fmtPct(deltaPct)}`;
  const detail =
    direction === "flat"
      ? `Holding around ${current.toFixed(def.digits ?? 0)}${def.unit} — within ${Math.abs(deltaPct).toFixed(0)}% of the ${baselineDesc} baseline.`
      : `${arrow} ${current.toFixed(def.digits ?? 0)}${def.unit} now vs ${baseline.toFixed(def.digits ?? 0)}${def.unit} ${baselineDesc} baseline (${fmtPct(deltaPct)})` +
        (streakDays >= 3 ? `, ${streakDays} days running` : "") +
        (Math.abs(slopePerWeek) >= 3 ? ` · ${fmtPct(slopePerWeek)}/wk` : "") +
        ".";

  return { def, series, current, baseline, deltaPct, slopePerWeek, direction, streak, severity, good, headline, detail };
}

/** Client-side: derive baseline (older ~75%) + recent (last ~25%) from a series. */
export function analyze(def: MetricDef, pts: StatPoint[]): Trend | null {
  const series = toSeries(pts, def.pick ?? "mean");
  if (series.length < 6) return null;
  const recentN = Math.max(2, Math.round(series.length * 0.25));
  const current = mean(series.slice(-recentN).map((p) => p.v));
  const base = series.slice(0, series.length - recentN);
  const baseline = base.length >= 2 ? mean(base.map((p) => p.v)) : mean(series.map((p) => p.v));
  return finalize(def, current, baseline, series, `${base.length}-day`);
}

/** Server-side: baseline + recent already computed over months in InfluxDB; `series` is just for the sparkline. */
export function analyzeScalars(def: MetricDef, baseline: number, recent: number, series: Series): Trend | null {
  return finalize(def, recent, baseline, series, "90-day");
}

/** Rank most-significant first; bad movements bubble above good ones of equal size. */
export function rank(trends: Trend[]): Trend[] {
  return [...trends].sort((a, b) => {
    const wa = a.severity + (a.good === false ? 0.15 : 0);
    const wb = b.severity + (b.good === false ? 0.15 : 0);
    return wb - wa;
  });
}
