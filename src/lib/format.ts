/** Format a number with sensible rounding, or a dash when null. */
export function n(v: number | null, digits = 0): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ---- Dates & times ----
// All times/dates render in South African time with en-ZA formatting, pinned
// so they read the same regardless of the viewing device's timezone/locale.
export const TZ = "Africa/Johannesburg";
export const LOCALE = "en-ZA";

/** "14:30" — 24-hour clock in SAST. */
export function clock(t: number | Date): string {
  return new Date(t).toLocaleTimeString(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}
/** "2026/07/12" — en-ZA short date in SAST. */
export function dateShort(t: number | Date = Date.now()): string {
  return new Date(t).toLocaleDateString(LOCALE, { timeZone: TZ });
}
/** "Sun, 12 Jul" — weekday + day + month in SAST. */
export function dateMedium(t: number | Date = Date.now()): string {
  return new Date(t).toLocaleDateString(LOCALE, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}
/** "Sun 12 Jul, 14:30". */
export function dateTime(t: number | Date): string {
  return `${dateMedium(t)}, ${clock(t)}`;
}
/** Hour of day (0–23) in SAST — for greeting / hour bucketing. */
export function sastHour(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "numeric", hour12: false }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
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

/** Duration in seconds → "7h 12m" (Oura reports durations in seconds). */
export function dur(v: number | null): string {
  if (v == null) return "—";
  const mins = Math.round(v / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Compact thousands (e.g. 3582 → "3,582"). */
export function thousands(v: number | null): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString();
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
