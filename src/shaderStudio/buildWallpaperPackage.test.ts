import { describe, expect, it } from "vitest";
import {
  buildShaderMultipassWebWallpaperFiles,
  buildShaderWebWallpaperFiles,
  serializeMultipass,
} from "./buildWallpaperPackage";
import { prepareMultipassFromJson } from "./shadertoyImport";

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

function sampleMultipassJson(): unknown {
  return {
    info: { name: "Ping" },
    renderpass: [
      { type: "common", name: "Common", code: "float kShared = 2.0;" },
      {
        type: "buffer",
        name: "Buffer B",
        code: "void mainImage(out vec4 c, in vec2 fc){ c = texelFetch(iChannel2, ivec2(fc), 0) + vec4(kShared); }",
        inputs: [
          { channel: 2, type: "buffer", id: "bufBself" },
          { channel: 3, type: "keyboard", id: "kb" },
        ],
        outputs: [{ id: "bufBself", channel: 0 }],
      },
      {
        type: "image",
        name: "Image",
        code: "void mainImage(out vec4 c, in vec2 fc){ c = texelFetch(iChannel2, ivec2(0,1), 0); }",
        inputs: [{ channel: 2, type: "buffer", id: "bufBself" }],
        outputs: [{ id: "imgout", channel: 0 }],
      },
    ],
  };
}

describe("serializeMultipass", () => {
  it("produces passes in buffer-then-image order with normalized inputs/outputs", () => {
    const prepared = prepareMultipassFromJson(sampleMultipassJson() as never);
    const payload = serializeMultipass(prepared);
    expect(payload.title).toBe("Ping");
    expect(payload.common).toContain("kShared");
    expect(payload.passes.map((p) => p.kind)).toEqual(["buffer", "image"]);
    const buf = payload.passes[0]!;
    expect(buf.outputId).toBe("bufBself");
    expect(buf.inputs).toEqual([
      { channel: 2, kind: "buffer", id: "bufBself" },
      { channel: 3, kind: "keyboard" },
    ]);
    const img = payload.passes[1]!;
    expect(img.kind).toBe("image");
    expect(img.inputs).toEqual([{ channel: 2, kind: "buffer", id: "bufBself" }]);
    expect(img.outputId).toBeUndefined();
  });
});

describe("buildShaderMultipassWebWallpaperFiles", () => {
  it("emits a v1 waypaper.json manifest flagged as multipass", () => {
    const prepared = prepareMultipassFromJson(sampleMultipassJson() as never);
    const { "waypaper.json": wj } = buildShaderMultipassWebWallpaperFiles({
      prepared,
      title: "Ping Wallpaper",
    });
    const m = JSON.parse(wj) as Record<string, unknown>;
    expect(m.waypaper).toBe("1");
    expect(m.title).toBe("Ping Wallpaper");
    expect(m.entry).toBe("index.html");
    expect(m.capabilities).toMatchObject({ pointer_interactive: true });
    expect(m.shader).toMatchObject({ kind: "multipass" });
  });

  it("embeds pass bodies, Common tab and input wiring into index.html", () => {
    const prepared = prepareMultipassFromJson(sampleMultipassJson() as never);
    const { "index.html": html } = buildShaderMultipassWebWallpaperFiles({
      prepared,
      title: "Ping",
    });
    expect(html).toContain("window.__WP_MP__=");
    expect(html).toContain("EXT_color_buffer_float");
    expect(html).toMatch(/vec2 fc\s*=\s*gl_FragCoord\.xy/);
    expect(html).toContain("kShared");
    expect(html).toContain("texelFetch(iChannel2, ivec2(0,1), 0)");
    expect(html).toContain('"kind":"buffer"');
    expect(html).toContain('"kind":"keyboard"');
    expect(html).toContain('"outputId":"bufBself"');
  });

  it("escapes </script> inside the payload to avoid breaking out of the script tag", () => {
    const prepared = prepareMultipassFromJson({
      info: { name: "evil" },
      renderpass: [
        {
          type: "image",
          name: "Image",
          code: "/* </script><script>alert(1)</script> */ void mainImage(out vec4 c, in vec2 f){c=vec4(0);}",
          outputs: [{ id: "out", channel: 0 }],
        },
      ],
    } as never);
    const { "index.html": html } = buildShaderMultipassWebWallpaperFiles({
      prepared,
      title: "evil",
    });
    expect(html).not.toMatch(/<\/script>\s*<script>alert/);
    expect(html).toContain("<\\/script>");
  });
});
