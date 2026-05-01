import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAppTypography,
  normalizeFontPreset,
  sanitizeFontStack,
  resolvedStacksForPreset,
} from "../appTypography";
import {
  BUNDLED_FONT_BODY,
  BUNDLED_FONT_DISPLAY,
  BUNDLED_FONT_MONO,
  GOOGLE_SANS_FONT_MONO,
  GOOGLE_SANS_FONT_UI,
  SYSTEM_FONT_BODY,
  SYSTEM_FONT_MONO,
} from "../typographyStacks";

describe("normalizeFontPreset", () => {
  it("defaults empty and unknown to bundled", () => {
    expect(normalizeFontPreset(undefined)).toBe("bundled");
    expect(normalizeFontPreset("")).toBe("bundled");
    expect(normalizeFontPreset("nope")).toBe("bundled");
  });

  it("accepts known presets case-insensitively", () => {
    expect(normalizeFontPreset("GOOGLE_SANS")).toBe("google_sans");
    expect(normalizeFontPreset(" System ")).toBe("system");
    expect(normalizeFontPreset("custom")).toBe("custom");
  });
});

describe("sanitizeFontStack", () => {
  it("returns null for empty and rejects injection-ish chars", () => {
    expect(sanitizeFontStack("")).toBe(null);
    expect(sanitizeFontStack("   ")).toBe(null);
    expect(sanitizeFontStack("foo;bar")).toBe(null);
    expect(sanitizeFontStack("a{b}")).toBe(null);
  });

  it("trims and strips control characters", () => {
    expect(sanitizeFontStack('  "Fira Sans", sans-serif  ')).toBe('"Fira Sans", sans-serif');
    expect(sanitizeFontStack("A\u0000B")).toBe("AB");
  });

  it("truncates long input", () => {
    const long = "a".repeat(500);
    expect(sanitizeFontStack(long)!.length).toBe(400);
  });
});

describe("applyAppTypography", () => {
  const removeProperty = vi.fn();
  const setProperty = vi.fn();

  afterEach(() => {
    removeProperty.mockClear();
    setProperty.mockClear();
    vi.restoreAllMocks();
  });

  function mockRoot() {
    vi.spyOn(document, "documentElement", "get").mockReturnValue({
      style: { removeProperty, setProperty },
    } as unknown as HTMLElement);
  }

  it("bundled removes inline font vars", () => {
    mockRoot();
    applyAppTypography({
      font_preset: "bundled",
      font_family_body: "",
      font_family_display: "",
      font_family_mono: "",
    });
    expect(removeProperty).toHaveBeenCalledWith("--font-body");
    expect(removeProperty).toHaveBeenCalledWith("--font-display");
    expect(removeProperty).toHaveBeenCalledWith("--font-mono");
    expect(setProperty).not.toHaveBeenCalled();
  });

  it("google_sans and system set stacks", () => {
    mockRoot();
    applyAppTypography({
      font_preset: "google_sans",
      font_family_body: "",
      font_family_display: "",
      font_family_mono: "",
    });
    expect(setProperty).toHaveBeenCalledWith("--font-body", GOOGLE_SANS_FONT_UI);
    expect(setProperty).toHaveBeenCalledWith("--font-display", GOOGLE_SANS_FONT_UI);
    expect(setProperty).toHaveBeenCalledWith("--font-mono", GOOGLE_SANS_FONT_MONO);

    removeProperty.mockClear();
    setProperty.mockClear();

    applyAppTypography({
      font_preset: "system",
      font_family_body: "",
      font_family_display: "",
      font_family_mono: "",
    });
    expect(setProperty).toHaveBeenCalledWith("--font-body", SYSTEM_FONT_BODY);
    expect(setProperty).toHaveBeenCalledWith("--font-display", SYSTEM_FONT_BODY);
    expect(setProperty).toHaveBeenCalledWith("--font-mono", SYSTEM_FONT_MONO);
  });

  it("custom sets only valid axes and omits invalid", () => {
    mockRoot();
    applyAppTypography({
      font_preset: "custom",
      font_family_body: '"Foo", sans-serif',
      font_family_display: "bad;display",
      font_family_mono: "",
    });
    expect(setProperty).toHaveBeenCalledWith("--font-body", '"Foo", sans-serif');
    expect(removeProperty).toHaveBeenCalledWith("--font-display");
    expect(removeProperty).toHaveBeenCalledWith("--font-mono");
  });
});

describe("resolvedStacksForPreset", () => {
  it("matches bundled and google stacks", () => {
    const b = resolvedStacksForPreset("bundled");
    expect(b.body).toBe(BUNDLED_FONT_BODY);
    expect(b.display).toBe(BUNDLED_FONT_DISPLAY);
    expect(b.mono).toBe(BUNDLED_FONT_MONO);
    const g = resolvedStacksForPreset("google_sans");
    expect(g.body).toBe(GOOGLE_SANS_FONT_UI);
    expect(g.mono).toBe(GOOGLE_SANS_FONT_MONO);
  });

  it("custom merges with bundled fallbacks", () => {
    const c = resolvedStacksForPreset("custom", {
      font_family_body: '"X", serif',
    });
    expect(c.body).toBe('"X", serif');
    expect(c.display).toBe(BUNDLED_FONT_DISPLAY);
    expect(c.mono).toBe(BUNDLED_FONT_MONO);
  });
});
