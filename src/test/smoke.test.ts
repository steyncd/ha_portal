import { describe, it, expect } from "vitest";

// Harness smoke test — confirms Vitest + jsdom are wired up. Real suites live
// alongside the modules they cover (src/lib/*.test.ts).
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
  it("has a DOM", () => {
    expect(typeof document).toBe("object");
  });
});
