/** Format a number with sensible rounding, or a dash when null. */
export function n(v: number | null, digits = 0): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Power in W, auto-scaling to kW above 1000. */
export function power(w: number | null): { val: string; unit: string } {
  if (w == null) return { val: "—", unit: "W" };
  const a = Math.abs(w);
  if (a >= 1000) return { val: (w / 1000).toFixed(2), unit: "kW" };
  return { val: Math.round(w).toString(), unit: "W" };
}

/** South African Rand. */
export function rand(v: number | null): string {
  if (v == null) return "—";
  return "R " + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Bucket a cumulative-daily sensor's history (resets at midnight) into
 * per-day peak values for the last `days` days, oldest → newest.
 */
export function dailyMax(
  points: { t: number; v: number }[],
  days = 7,
): { label: string; value: number | null }[] {
  const peaks = new Map<number, number>();
  for (const p of points) {
    const d = new Date(p.t);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    peaks.set(key, Math.max(peaks.get(key) ?? 0, p.v));
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { label: string; value: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    out.push({
      label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      value: peaks.has(d.getTime()) ? peaks.get(d.getTime())! : null,
    });
  }
  return out;
}

/** Map a temperature to a comfort colour. */
export function tempColor(t: number | null): string {
  if (t == null) return "var(--muted)";
  if (t < 16) return "var(--water)";
  if (t > 26) return "var(--error)";
  if (t >= 20 && t <= 24) return "var(--success)";
  return "var(--warning)";
}
