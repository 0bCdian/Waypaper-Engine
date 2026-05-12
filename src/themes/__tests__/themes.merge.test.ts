import { describe, expect, it } from "vitest";
import { builtInThemes } from "../../styles/themes/_index";
import { daisyStockThemeMetas, themes } from "../themes";

describe("theme list merge (audited + Daisy stock)", () => {
  it("includes a Daisy-only stock theme in the picker list", () => {
    expect(themes.some((t) => t.name === "cupcake")).toBe(true);
    expect(themes.some((t) => t.name === "synthwave")).toBe(true);
  });

  it("does not duplicate themes overridden by audited CSS (same name:)", () => {
    expect(builtInThemes.some((t) => t.name === "nord")).toBe(true);
    expect(themes.filter((t) => t.name === "nord")).toHaveLength(1);
  });

  it("has length audited count + Daisy stock minus name collisions", () => {
    const auditedNames = new Set(builtInThemes.map((t) => t.name));
    const extra = daisyStockThemeMetas.filter((t) => !auditedNames.has(t.name)).length;
    expect(themes.length).toBe(builtInThemes.length + extra);
  });
});
