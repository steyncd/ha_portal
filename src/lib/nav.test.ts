import { describe, it, expect } from "vitest";
import { NAV, NAV_GROUPS, GUEST_HIDDEN } from "./nav";

describe("NAV data integrity", () => {
  it("has unique view ids", () => {
    const ids = NAV.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every item has a name, icon name and color", () => {
    for (const item of NAV) {
      expect(item.name, item.id).toBeTruthy();
      expect(item.ic, item.id).toBeTruthy();
      expect(item.color, item.id).toMatch(/^var\(--/);
    }
  });
  it("every grouped item's group (besides top/bottom) is a declared NAV_GROUP", () => {
    const groups = new Set(NAV_GROUPS.map((g) => g.key));
    for (const item of NAV) {
      if (item.group === "" || item.group === "Bottom") continue;
      expect(groups.has(item.group), `${item.id} → ${item.group}`).toBe(true);
    }
  });
  it("every declared NAV_GROUP contains at least one item", () => {
    for (const g of NAV_GROUPS) {
      expect(NAV.some((n) => n.group === g.key), g.key).toBe(true);
    }
  });
  it("GUEST_HIDDEN has no duplicates", () => {
    expect(new Set(GUEST_HIDDEN).size).toBe(GUEST_HIDDEN.length);
  });
});
