import { describe, expect, it } from "vitest";

import { builtInThemes } from "../../src/styles/themes/_index";

describe("theme registry", () => {
  it("exports a readonly builtInThemes array", () => {
    expect(Array.isArray(builtInThemes)).toBe(true);
  });

  it("each theme entry has required fields", () => {
    for (const t of builtInThemes) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.displayName).toBe("string");
      expect(["light", "dark", "mixed"]).toContain(t.category);
      expect(t.source).toBe("builtin");
    }
  });
});
