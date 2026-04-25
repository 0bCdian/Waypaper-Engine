import { describe, expect, it } from "vitest";
import {
  buffersInExportOrder,
  findImagePass,
  normalizeInputKind,
  normalizePreprocessorSpacing,
  parseShadertoyJson,
  prepareMultipassFromJson,
  stripInvalidFloatSuffix,
  type ShadertoyRenderPass,
} from "./shadertoyImport";

describe("normalizeInputKind", () => {
  it("reads extension field type", () => {
    expect(normalizeInputKind({ channel: 0, type: "buffer" })).toBe("buffer");
  });

  it("reads official ctype when type absent", () => {
    expect(normalizeInputKind({ channel: 1, ctype: "texture" })).toBe("texture");
  });
});

describe("buffersInExportOrder", () => {
  it("keeps buffer passes in array order (not image/common position)", () => {
    const rp = [
      { type: "image", name: "Image" },
      { type: "common", name: "Common" },
      { type: "buffer", name: "BufA", outputs: [{ id: "a" }] },
      { type: "buffer", name: "BufB", outputs: [{ id: "b" }] },
    ];
    const buf = buffersInExportOrder(rp as ShadertoyRenderPass[]);
    expect(buf.map((p) => p.name)).toEqual(["BufA", "BufB"]);
  });
});

describe("prepareMultipassFromJson", () => {
  it("throws without image pass", () => {
    const data = {
      renderpass: [
        { type: "buffer", name: "B", code: "void mainImage(out vec4 c,vec2 f){c=vec4(0);}" },
      ],
    };
    expect(() => prepareMultipassFromJson(data)).toThrow(/no image pass/i);
  });

  it("builds bodies and strips float f suffix by default", () => {
    const data = {
      renderpass: [
        {
          type: "common",
          name: "C",
          code: "float x=1.0f;",
        },
        {
          type: "buffer",
          name: "B",
          code: "void mainImage(out vec4 c, in vec2 f){ float y=2f; c=vec4(x+y); }",
          outputs: [{ id: "bid" }],
        },
        {
          type: "image",
          name: "Image",
          code: "void mainImage(out vec4 c, in vec2 f){ c=vec4(0.5f); }",
        },
      ],
    };
    const p = prepareMultipassFromJson(data);
    expect(p.commonSanitized).toContain("float x=1.0;");
    expect(p.commonSanitized).not.toMatch(/1\.0f\b/i);
    expect(p.bodies.B).toContain("2.0");
    expect(p.bodies.B).not.toMatch(/\b2f\b/i);
    expect(p.bodies.Image).toContain("vec4(0.5);");
    expect(p.buffers).toHaveLength(1);
  });

  it("treats pass type case-insensitively for common, buffer, and image", () => {
    const data = {
      renderpass: [
        { type: "Common", name: "C", code: "float shared=1.0;" },
        {
          type: "Buffer",
          name: "B",
          code: "void mainImage(out vec4 c, in vec2 f){ c=vec4(shared); }",
          outputs: [{ id: "bid" }],
        },
        {
          type: "Image",
          name: "Image",
          code: "void mainImage(out vec4 c, in vec2 f){ c=vec4(1.0); }",
        },
      ],
    };
    const p = prepareMultipassFromJson(data);
    expect(p.commonSanitized).toContain("float shared=1.0;");
    expect(p.buffers).toHaveLength(1);
    expect(p.bodies.B).toContain("shared");
  });
});

describe("stripInvalidFloatSuffix", () => {
  it("removes fractional and integer f suffixes", () => {
    expect(stripInvalidFloatSuffix("float a = 1.0f;")).toBe("float a = 1.0;");
    expect(stripInvalidFloatSuffix("float b = 36f;")).toBe("float b = 36.0;");
  });
});

describe("normalizePreprocessorSpacing", () => {
  it("fixes spaced hash directives", () => {
    const s = "# define FOO 1\n# ifdef X\n# endif";
    expect(normalizePreprocessorSpacing(s)).toContain("#define FOO");
    expect(normalizePreprocessorSpacing(s)).toContain("#ifdef X");
    expect(normalizePreprocessorSpacing(s)).toContain("#endif");
  });
});

describe("parseShadertoyJson", () => {
  it("parses valid JSON", () => {
    const j = parseShadertoyJson('{"renderpass":[]}');
    expect(j.renderpass).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseShadertoyJson("not json")).toThrow(/invalid json/i);
  });
});

describe("findImagePass", () => {
  it("finds image among mixed passes", () => {
    const rp = [{ type: "buffer" }, { type: "image", name: "I" }] as ShadertoyRenderPass[];
    expect(findImagePass(rp)?.name).toBe("I");
  });
});
