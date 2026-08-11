// Pure, Firebase-free Life-OS math. Imported by lifePlus.svelte.ts + Life.svelte
// so the logic is unit-testable without pulling in Firebase or the rune runtime.
// The server keeps a mirror of dueInDays in functions/classify.js — a parity test
// guards the two from drifting.

/** "YYYY-MM" for the given date (defaults to now). */
export const monthKey = (ref: Date = new Date()): string => ref.toISOString().slice(0, 7);

/** Days until the next occurrence of a monthly due-day (0 = today), month-clamped. */
export function dueInDays(dueDay: number, ref: Date = new Date()): number {
  const now = new Date(ref);
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear(), m = now.getMonth();
  const clamp = (yr: number, mo: number) => Math.min(dueDay, new Date(yr, mo + 1, 0).getDate());
  let next = new Date(y, m, clamp(y, m));
  if (next.getTime() < now.getTime()) {
    const nm = new Date(y, m + 1, 1);
    next = new Date(nm.getFullYear(), nm.getMonth(), clamp(nm.getFullYear(), nm.getMonth()));
  }
  return Math.round((next.getTime() - now.getTime()) / 864e5);
}

/** Monday 00:00 of the current week, in epoch ms. */
export function weekStart(ref: Date = new Date()): number {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return d.getTime();
}

type PointItem = { done: boolean; assignee: string; points: number; doneAt?: number | null };

/** Per-person points for done items since Monday, highest first. */
export function leaderboard<T extends { key: string }>(family: readonly T[], items: PointItem[], ref: Date = new Date()): (T & { pts: number })[] {
  const ws = weekStart(ref);
  return family
    .map((f) => ({ ...f, pts: items.filter((i) => i.done && i.assignee === f.key && (i.doneAt ?? 0) >= ws).reduce((s, i) => s + i.points, 0) }))
    .sort((a, b) => b.pts - a.pts);
}

type BillItem = { amount: number; dueDay: number; paidMonth: string; category?: string };

/** Bills not yet paid this month. */
export function unpaidBills<T extends BillItem>(bills: T[], mkey: string = monthKey()): T[] {
  return bills.filter((b) => b.paidMonth !== mkey);
}

/** Unpaid bills due within `days` of `ref`. */
export function dueSoonBills<T extends BillItem>(bills: T[], days = 7, ref: Date = new Date()): T[] {
  return unpaidBills(bills, monthKey(ref)).filter((b) => dueInDays(b.dueDay, ref) <= days);
}

/** Monthly spend grouped by category, descending, with the max for bar scaling. */
export function categoryBreakdown<T extends BillItem>(bills: T[]): { arr: { cat: string; amt: number }[]; max: number } {
  const map = new Map<string, number>();
  for (const b of bills) map.set(b.category || "Other", (map.get(b.category || "Other") ?? 0) + b.amount);
  const arr = [...map.entries()].map(([cat, amt]) => ({ cat, amt })).sort((a, b) => b.amt - a.amt);
  return { arr, max: Math.max(1, ...arr.map((a) => a.amt)) };
}
