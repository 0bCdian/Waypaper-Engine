import { describe, expect, it } from "vitest";
import { pageSlots } from "../pageSlots";

describe("pageSlots", () => {
  it("lists every page when there are 7 or fewer", () => {
    expect(pageSlots(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("always returns 7 slots for longer lists, wherever the current page is", () => {
    for (let current = 1; current <= 24; current++) {
      const slots = pageSlots(current, 24);
      expect(slots).toHaveLength(7);
      expect(slots).toContain(current);
      expect(slots[0]).toBe(1);
      expect(slots[6]).toBe(24);
    }
  });

  it("windows around the current page", () => {
    expect(pageSlots(1, 24)).toEqual([1, 2, 3, 4, 5, "gap-end", 24]);
    expect(pageSlots(12, 24)).toEqual([1, "gap-start", 11, 12, 13, "gap-end", 24]);
    expect(pageSlots(24, 24)).toEqual([1, "gap-start", 20, 21, 22, 23, 24]);
  });
});
