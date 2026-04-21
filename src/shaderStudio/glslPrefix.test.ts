import { describe, expect, it } from "vitest";
import {
  buildFragmentShader,
  buildPrefix,
  detectCubeChannels,
  remapShaderErrors,
  vertexSource,
} from "./glslPrefix";

describe("detectCubeChannels", () => {
  it("detects vec3 coord for iChannel0", () => {
    const code = `void mainImage(out vec4 c, in vec2 fc) { c = texture(iChannel0, rd); }`;
    const ch = detectCubeChannels(code);
    expect(ch).toEqual([true, false, false, false]);
  });

  it("treats .xy swizzle as 2D", () => {
    const code = `void mainImage(out vec4 c, in vec2 fc) { c = texture(iChannel1, uv.xy); }`;
    expect(detectCubeChannels(code)).toEqual([false, false, false, false]);
  });

  it("detects reflect() as cube hint in texture arg", () => {
    const code = `void mainImage(out vec4 c, in vec2 fc) { c = texture(iChannel2, reflect(a,b)); }`;
    const ch = detectCubeChannels(code);
    expect(ch[2]).toBe(true);
  });
});

describe("buildPrefix", () => {
  it("declares sampler2D when no cube channels", () => {
    const { src } = buildPrefix([false, false, false, false], true);
    expect(src).toContain("uniform sampler2D   iChannel0;");
    expect(src).toContain("#version 300 es");
    expect(src).toContain("uniform vec3      iChannelResolution[4];");
    expect(src).toContain("uniform float     iChannelTime[4];");
    expect(src).toContain("uniform float     iFrameRate;");
    expect(src).not.toContain("v_FragCoord");
  });

  it("declares samplerCube when flagged", () => {
    const { src } = buildPrefix([true, false, false, false], false);
    expect(src).toContain("uniform samplerCube iChannel0;");
    expect(src).not.toContain("#version 300 es");
    expect(src).not.toContain("v_FragCoord");
  });
});

describe("buildFragmentShader", () => {
  it("appends main() that passes gl_FragCoord.xy directly into mainImage (Shadertoy Y-up origin)", () => {
    const user = `void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0); }`;
    const { source, cubeChannels } = buildFragmentShader(user, true);
    expect(cubeChannels.every((c) => !c)).toBe(true);
    expect(source).toContain("void mainImage");
    expect(source).toContain("void main(){vec2 fc=gl_FragCoord.xy;vec4 c=vec4(0.);mainImage(c,fc);_fragColor=c;}");
    expect(source).not.toContain("iResolution.y-gl_FragCoord.y");
  });
});

describe("remapShaderErrors", () => {
  it("subtracts prefix line count from driver line numbers", () => {
    const raw = "ERROR: 0:42:syntax error";
    const out = remapShaderErrors(raw, 40);
    expect(out).toContain("ERROR: line 2:");
  });

  it("clamps to line 1", () => {
    const out = remapShaderErrors("ERROR: 0:5:oops", 10);
    expect(out).toContain("ERROR: line 1:");
  });
});

describe("vertexSource", () => {
  it("returns GL2 or GL1 shader", () => {
    expect(vertexSource(true)).toContain("#version 300 es");
    expect(vertexSource(false)).toContain("attribute vec2 _pos");
  });

  it("uses passthrough quad (fragCoord derived in fragment shader)", () => {
    expect(vertexSource(true)).not.toContain("v_FragCoord");
    expect(vertexSource(true)).not.toContain("iResolution");
    expect(vertexSource(true)).toContain("gl_Position=vec4(_pos");
  });
});
