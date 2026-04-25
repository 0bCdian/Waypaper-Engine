import { describe, expect, it } from "vitest";
import { clientXToWipeMix } from "../compareWipePointer";

function rect(
  left: number,
  width: number,
  height: number,
): Pick<DOMRect, "left" | "width" | "height"> {
  return { left, width, height };
}

describe("clientXToWipeMix", () => {
  it("maps across full width when box aspect matches canvas", () => {
    const r = rect(100, 200, 100);
    expect(clientXToWipeMix(100, r, 200, 100)).toBe(0);
    expect(clientXToWipeMix(200, r, 200, 100)).toBe(0.5);
    expect(clientXToWipeMix(300, r, 200, 100)).toBe(1);
  });

  it("ignores horizontal letterboxing (object-contain, wide box)", () => {
    // 200×100 box, 1:1 canvas → fitted square 100×100, 50px bars left/right
    const r = rect(0, 200, 100);
    expect(clientXToWipeMix(50, r, 100, 100)).toBe(0);
    expect(clientXToWipeMix(100, r, 100, 100)).toBe(0.5);
    expect(clientXToWipeMix(150, r, 100, 100)).toBe(1);
  });

  it("ignores vertical letterboxing (tall box)", () => {
    const r = rect(0, 100, 200);
    expect(clientXToWipeMix(0, r, 100, 100)).toBe(0);
    expect(clientXToWipeMix(100, r, 100, 100)).toBe(1);
  });

  it("returns null for invalid size", () => {
    expect(clientXToWipeMix(0, rect(0, 0, 10), 10, 10)).toBeNull();
    expect(clientXToWipeMix(0, rect(0, 10, 10), 0, 10)).toBeNull();
  });
});
