import { describe, it, expect } from "vitest";
import { monthKey, dueInDays, weekStart, leaderboard, unpaidBills, dueSoonBills, categoryBreakdown } from "./lifeCalc";
// The server keeps its own copy in functions/classify.js — imported here to
// assert the two never drift (bill-due alerts vs the "due soon" UI).
import { dueInDaysServer } from "../../functions/classify.js";

describe("monthKey", () => {
  it("formats YYYY-MM", () => expect(monthKey(new Date("2026-08-06T10:00:00Z"))).toBe("2026-08"));
});

describe("dueInDays", () => {
  const ref = new Date(2026, 7, 6); // 6 Aug 2026 (local)
  it("today → 0", () => expect(dueInDays(6, ref)).toBe(0));
  it("later this month", () => expect(dueInDays(10, ref)).toBe(4));
  it("past day rolls to next month", () => expect(dueInDays(1, ref)).toBe(26));
  it("clamps to a short month (Feb 31 → 28 in 2026)", () => {
    expect(dueInDays(31, new Date(2026, 1, 10))).toBe(18); // 28 Feb - 10 Feb
  });
});

describe("client/server dueInDays parity", () => {
  it("matches for every due-day across several months", () => {
    const refs = [new Date(2026, 0, 15), new Date(2026, 1, 3), new Date(2026, 3, 30), new Date(2027, 11, 1)];
    for (const ref of refs) {
      for (let d = 1; d <= 31; d++) {
        expect(dueInDaysServer(d, ref.getTime()), `d=${d} @ ${ref.toDateString()}`).toBe(dueInDays(d, ref));
      }
    }
  });
});

describe("weekStart", () => {
  it("returns Monday 00:00", () => {
    const ws = new Date(weekStart(new Date(2026, 7, 6, 15, 30))); // Thu 6 Aug 2026
    expect(ws.getDay()).toBe(1); // Monday
    expect(ws.getHours()).toBe(0);
  });
});

describe("leaderboard", () => {
  const fam = [{ key: "christo" }, { key: "mandri" }];
  const ref = new Date(2026, 7, 6, 12); // Thu
  const monday = weekStart(ref);
  it("sums done points since Monday, sorted desc", () => {
    const items = [
      { done: true, assignee: "christo", points: 3, doneAt: monday + 1000 },
      { done: true, assignee: "christo", points: 2, doneAt: monday + 2000 },
      { done: true, assignee: "mandri", points: 1, doneAt: monday + 3000 },
      { done: false, assignee: "mandri", points: 5, doneAt: monday + 4000 }, // not done
      { done: true, assignee: "christo", points: 9, doneAt: monday - 86_400_000 }, // last week
    ];
    const board = leaderboard(fam, items, ref);
    expect(board[0]).toMatchObject({ key: "christo", pts: 5 });
    expect(board[1]).toMatchObject({ key: "mandri", pts: 1 });
  });
});

describe("bills helpers", () => {
  const ref = new Date(2026, 7, 6);
  const mk = monthKey(ref);
  const bills = [
    { amount: 100, dueDay: 6, paidMonth: "", category: "Utilities" }, // due today, unpaid
    { amount: 200, dueDay: 20, paidMonth: "", category: "Insurance" }, // due later, unpaid
    { amount: 50, dueDay: 3, paidMonth: mk, category: "Utilities" }, // paid this month
  ];
  it("unpaidBills excludes paid-this-month", () => {
    expect(unpaidBills(bills, mk)).toHaveLength(2);
  });
  it("dueSoonBills keeps only unpaid within the window", () => {
    const soon = dueSoonBills(bills, 7, ref);
    expect(soon).toHaveLength(1);
    expect(soon[0].amount).toBe(100);
  });
  it("categoryBreakdown groups + sorts by spend", () => {
    const { arr, max } = categoryBreakdown(bills);
    expect(arr[0]).toEqual({ cat: "Insurance", amt: 200 });
    expect(arr.find((c) => c.cat === "Utilities")!.amt).toBe(150);
    expect(max).toBe(200);
  });
});
