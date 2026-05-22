import { describe, expect, it } from "vitest";
import { formatLoopTime, parseLoopTime } from "../timeFormat";

describe("loopStudio timeFormat", () => {
  it("parseLoopTime roundtrips formatted value", () => {
    const t = 65.25;
    const s = formatLoopTime(t);
    expect(parseLoopTime(s)).toBeCloseTo(t, 2);
  });

  it("parseLoopTime rejects garbage", () => {
    expect(Number.isNaN(parseLoopTime("abc"))).toBe(true);
  });
});
