/**
 * Shadertoy-style fragment prefix + main() wrapper (ported from ShaderWall).
 */

export type GlVersion = "webgl2" | "webgl1";

const VS_GL2 = `#version 300 es
in vec2 _pos;
void main(){gl_Position=vec4(_pos,0.,1.);}`;

const VS_GL1 = `attribute vec2 _pos;
void main(){gl_Position=vec4(_pos,0.,1.);}`;

export function vertexSource(isGL2: boolean): string {
  return isGL2 ? VS_GL2 : VS_GL1;
}

/**
 * Scan user code to decide which iChannel slots need samplerCube.
 */
export function detectCubeChannels(code: string): boolean[] {
  const cube = [false, false, false, false];
  const re = /\btexture\s*\(\s*iChannel(\d)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const ch = parseInt(m[1] ?? "9", 10);
    if (ch > 3) continue;
    let pos = m.index + m[0].length;
    let depth = 1;
    const argStart = pos;
    while (pos < code.length && depth > 0) {
      const c = code[pos];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        // Closing paren of texture(...) — stop before pos++ so slice excludes ')'.
        if (depth === 0) break;
      } else if (c === "," && depth === 1) break;
      pos++;
    }
    const arg = code.slice(argStart, pos).trim();

    const vec3Signals = [
      /\*\s*rot[xyz]\s*\(/,
      /rot[xyz]\s*\([^)]*\)\s*\*/,
      /\breflect\s*\(/,
      /\brefract\s*\(/,
      /\bnormalize\s*\([^)]*\brd\b/,
    ];
    const bareVec3 =
      /^[a-zA-Z_]\w*$/.test(arg) && /^(rd|dir|ray|normal|n|rfd|rfcol)$/.test(arg);
    const has2DSwizzle = /\.(xy|xz|yz|st|uv)\s*$/.test(arg);

    if (!has2DSwizzle && (bareVec3 || vec3Signals.some((p) => p.test(arg)))) {
      cube[ch] = true;
    }
  }
  return cube;
}

export function buildPrefix(cubeChans: boolean[], isGL2: boolean): { src: string; lineCount: number } {
  const chanDecls = [0, 1, 2, 3]
    .map((i) => `uniform ${cubeChans[i] ? "samplerCube" : "sampler2D  "} iChannel${i};`)
    .join("\n");

  let src: string;
  if (isGL2) {
    src = `#version 300 es
precision highp float;
precision highp int;
uniform vec3      iResolution;
uniform float     iTime;
uniform float     iTimeDelta;
uniform int       iFrame;
uniform vec4      iMouse;
uniform vec4      iDate;
uniform float     iSampleRate;
${chanDecls}
#define texture2D   texture
#define textureCube texture
out vec4 _fragColor;
`;
  } else {
    src = `precision highp float;
precision highp int;
uniform vec3      iResolution;
uniform float     iTime;
uniform float     iTimeDelta;
uniform int       iFrame;
uniform vec4      iMouse;
uniform vec4      iDate;
uniform float     iSampleRate;
${chanDecls}
float  round(float  x){return floor(x+.5);}
vec2   round(vec2   x){return floor(x+.5);}
vec3   round(vec3   x){return floor(x+.5);}
vec4   round(vec4   x){return floor(x+.5);}
`;
  }
  return { src, lineCount: src.split("\n").length };
}

export function buildFragmentShader(userCode: string, isGL2: boolean): {
  source: string;
  prefixLineCount: number;
  cubeChannels: boolean[];
} {
  const cubeChannels = detectCubeChannels(userCode);
  const { src: prefix, lineCount } = buildPrefix(cubeChannels, isGL2);
  const tail = isGL2
    ? "\nvoid main(){vec4 c=vec4(0.);mainImage(c,gl_FragCoord.xy);_fragColor=c;}"
    : "\nvoid main(){vec4 c=vec4(0.);mainImage(c,gl_FragCoord.xy);gl_FragColor=c;}";

  return {
    source: `${prefix}\n${userCode}${tail}`,
    prefixLineCount: lineCount,
    cubeChannels,
  };
}

export function remapShaderErrors(raw: string, prefixLineCount: number): string {
  return raw.replace(/ERROR:\s*\d+:(\d+):/g, (_m, ln: string) => {
    const user = Math.max(1, parseInt(ln, 10) - prefixLineCount);
    return `ERROR: line ${user}:`;
  });
}
