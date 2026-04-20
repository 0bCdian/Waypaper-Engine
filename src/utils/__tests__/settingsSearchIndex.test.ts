import { describe, it, expect } from "vitest";
import {
  entryMatchesSettingsSearchQuery,
  sectionsMatchingSettingsSearchQuery,
  filterSettingsSearchEntries,
} from "../settingsSearchIndex";

describe("settingsSearchIndex", () => {
  it("sectionsMatchingSettingsSearchQuery includes backend for semantic query", () => {
    expect(sectionsMatchingSettingsSearchQuery("backend")).toContain("backend");
  });

  it("multi-word backend settings matches backend section", () => {
    expect(sectionsMatchingSettingsSearchQuery("backend settings")).toContain("backend");
  });

  it("filterSettingsSearchEntries uses token AND on row haystack", () => {
    const rows = filterSettingsSearchEntries("backend settings");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.section === "backend")).toBe(true);
  });

  it("entryMatchesSettingsSearchQuery requires all tokens", () => {
    const fromBackend = filterSettingsSearchEntries("backend")[0];
    expect(entryMatchesSettingsSearchQuery(fromBackend, "backend type")).toBe(true);
    expect(entryMatchesSettingsSearchQuery(fromBackend, "backend xyznotfound")).toBe(false);
  });

  it("includes wallhaven for wallhaven query", () => {
    expect(sectionsMatchingSettingsSearchQuery("wallhaven")).toContain("wallhaven");
  });
});
