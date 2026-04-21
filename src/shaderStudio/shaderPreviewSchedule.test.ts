import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_DT,
  DEFAULT_PREVIEW_FRAME_COUNT,
  deterministicPreviewTimes,
  NEUTRAL_SHADERTOY_MOUSE,
} from "./shaderPreviewSchedule";

describe("deterministicPreviewTimes", () => {
  it("returns empty for zero frames", () => {
    expect(deterministicPreviewTimes(0, 0.05)).toEqual([]);
  });

  it("schedules i * dt", () => {
    const t = deterministicPreviewTimes(4, 0.1);
    expect(t).toHaveLength(4);
    expect(t[3]).toBeCloseTo(0.3, 10);
  });

  it("matches default dt slice length", () => {
    const n = DEFAULT_PREVIEW_FRAME_COUNT;
    const t = deterministicPreviewTimes(n, DEFAULT_PREVIEW_DT);
    expect(t).toHaveLength(n);
    expect(t[n - 1]).toBeCloseTo((n - 1) * DEFAULT_PREVIEW_DT, 10);
  });
});

describe("NEUTRAL_SHADERTOY_MOUSE", () => {
  it("is released-pattern vec4", () => {
    expect(NEUTRAL_SHADERTOY_MOUSE[0]).toBe(0);
    expect(NEUTRAL_SHADERTOY_MOUSE[1]).toBe(0);
    expect(NEUTRAL_SHADERTOY_MOUSE[2]).toBeLessThan(0);
    expect(NEUTRAL_SHADERTOY_MOUSE[3]).toBeLessThan(0);
  });
});
