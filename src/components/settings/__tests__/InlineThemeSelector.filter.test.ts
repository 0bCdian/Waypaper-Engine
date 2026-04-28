import { describe, it, expect } from "vitest";
import { filterThemesForPicker, type ThemePickerEntry } from "../InlineThemeSelector";

const sample: ThemePickerEntry[] = [
  {
    name: "light",
    displayName: "Light",
    description: "Clean default",
    category: "light",
    available: true,
  },
  {
    name: "dark",
    displayName: "Dark",
    description: "Night mode",
    category: "dark",
    available: true,
  },
  {
    name: "retro",
    displayName: "Retro",
    description: "Vintage mixed",
    category: "mixed",
    available: true,
  },
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

  it("matches substring search across name and description", () => {
    const r = filterThemesForPicker(sample, "all", "night");
    expect(r.map((t) => t.name)).toEqual(["dark"]);
  });

  it("requires all tokens across fields for multi-token query", () => {
    expect(filterThemesForPicker(sample, "all", "retro vintage").map((t) => t.name)).toEqual([
      "retro",
    ]);
  });
});
