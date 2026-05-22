import { describe, it, expect } from "vitest";
import { filterThemesForPicker, type ThemePickerEntry } from "../InlineThemeSelector";

const sample: ThemePickerEntry[] = [
  { name: "light", displayName: "Light", category: "light" },
  { name: "dark", displayName: "Dark", category: "dark" },
  { name: "retro", displayName: "Retro", category: "mixed" },
];

describe("filterThemesForPicker", () => {
  it("returns all themes when tone is all", () => {
    expect(filterThemesForPicker(sample, "all", "")).toHaveLength(3);
  });

  it("includes mixed themes in light filter", () => {
    const r = filterThemesForPicker(sample, "light", "");
    expect(r.map((t) => t.name).sort()).toEqual(["light", "retro"]);
  });

  it("includes mixed themes in dark filter", () => {
    const r = filterThemesForPicker(sample, "dark", "");
    expect(r.map((t) => t.name).sort()).toEqual(["dark", "retro"]);
  });

  it("matches substring search across name and displayName", () => {
    const r = filterThemesForPicker(sample, "all", "dark");
    expect(r.map((t) => t.name)).toEqual(["dark"]);
  });

  it("requires all tokens across name and displayName for multi-token query", () => {
    expect(filterThemesForPicker(sample, "all", "retro light").map((t) => t.name)).toEqual([]);
  });

  it("matches displayName case-insensitively", () => {
    const r = filterThemesForPicker(sample, "all", "RETRO");
    expect(r.map((t) => t.name)).toEqual(["retro"]);
  });
});
