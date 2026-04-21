import { describe, expect, it } from "vitest";
import { buildShaderWebWallpaperFiles } from "./buildWallpaperPackage";

describe("buildShaderWebWallpaperFiles", () => {
  it("produces valid JSON manifest with required fields", () => {
    const { "waypaper.json": wj } = buildShaderWebWallpaperFiles({
      shader: `void mainImage(out vec4 c, in vec2 fc){ c=vec4(1.0); }`,
      title: "Test Shader",
    });
    const m = JSON.parse(wj) as Record<string, unknown>;
    expect(m.waypaper).toBe("1");
    expect(m.title).toBe("Test Shader");
    expect(m.entry).toBe("index.html");
    expect(m.capabilities).toEqual({ pointer_interactive: true });
  });

  it("embeds fragment scripts and cube flags in index.html", () => {
    const code = `void mainImage(out vec4 c, in vec2 fc){ c=texture(iChannel0, rd); }`;
    const { "index.html": html } = buildShaderWebWallpaperFiles({ shader: code, title: "T" });
    expect(html).toContain("__WP_FRAG_GL2=");
    expect(html).toContain("__WP_FRAG_GL1=");
    expect(html).toContain("__WP_CUBE__=");
    expect(html).toMatch(/__WP_CUBE__=\[true,false,false,false\]/);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("uses fallback shader when empty", () => {
    const { "index.html": html } = buildShaderWebWallpaperFiles({ shader: "  ", title: "" });
    expect(html).toContain("mainImage");
    const wj = JSON.parse(
      buildShaderWebWallpaperFiles({ shader: "", title: "" })["waypaper.json"],
    ) as { title: string };
    expect(wj.title).toBeTruthy();
  });
});
