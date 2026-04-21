/**
 * Parse Shadertoy JSON exports (official API or browser extensions) and sanitize GLSL for our WebGL2 runner.
 */

export type ShadertoyPassType = "common" | "buffer" | "image" | "sound" | string;

export type ShadertoyInputKind =
  | "buffer"
  | "keyboard"
  | "texture"
  | "music"
  | "musicstream"
  | "microphone"
  | "cubemap"
  | "webcam"
  | "video"
  | string;

export type ShadertoyInput = {
  channel: number;
  id?: string;
  type?: string;
  ctype?: string;
  filepath?: string;
};

export type ShadertoyRenderPass = {
  name?: string;
  type?: ShadertoyPassType;
  code?: string;
  inputs?: ShadertoyInput[];
  outputs?: { channel?: number; id?: string }[];
};

export type ShadertoyJson = {
  ver?: string;
  renderpass?: ShadertoyRenderPass[];
  info?: { name?: string; id?: string };
};

/** Normalize official `ctype` or extension `type` into a lowercase channel kind. */
export function normalizeInputKind(inp: ShadertoyInput): ShadertoyInputKind {
  const raw = (inp.ctype ?? inp.type ?? "").toString().toLowerCase();
  return raw as ShadertoyInputKind;
}

/** Strip directives that conflict with our #version 300 es wrapper. */
export function sanitizeUserGlsl(code: string): string {
  const outLines: string[] = [];
  for (const line of code.split("\n")) {
    const s = line.trim();
    if (/^#\s*version\b/i.test(s)) continue;
    if (/^#\s*pragma\s+shader_stage\b/i.test(s)) continue;
    if (/^#\s*extension\s+GL_EXT_samplerless_texture_functions\b/i.test(s)) continue;
    outLines.push(line);
  }
  return `${outLines.join("\n").trim()}\n`;
}

/**
 * Collapse `# define` / `#  if` style spacing into valid GLSL preprocessor tokens.
 */
export function normalizePreprocessorSpacing(code: string): string {
  return code.replace(
    /(^|\n)(\s*)#\s+(define|undef|if|ifdef|ifndef|else|elif|endif|error|pragma|line)\b/gim,
    (_m, lead: string, indent: string, dir: string) => `${lead}${indent}#${dir}`,
  );
}

/**
 * Remove invalid C/HLSL-style float suffix (e.g. 1.0f, 36f) for GLSL ES.
 */
export function stripInvalidFloatSuffix(code: string): string {
  let s = code.replace(/\b(\d+\.\d+)f\b/gi, "$1");
  s = s.replace(/\b(\d+)f\b/gi, (_m, intPart: string) => `${intPart}.0`);
  return s;
}

function passTypeLower(p: ShadertoyRenderPass): string {
  return (p.type ?? "").toString().toLowerCase();
}

export function collectCommonCode(renderpasses: ShadertoyRenderPass[]): string {
  const parts = renderpasses.filter((p) => passTypeLower(p) === "common").map((p) => p.code ?? "");
  return parts.join("\n\n").trim();
}

export function passBodiesFromRenderpasses(renderpasses: ShadertoyRenderPass[]): Record<string, string> {
  const bodies: Record<string, string> = {};
  for (const p of renderpasses) {
    const t = passTypeLower(p);
    if (t === "buffer" || t === "image") {
      const name = p.name ?? String(t);
      bodies[name] = sanitizeUserGlsl(p.code ?? "");
    }
  }
  return bodies;
}

export function buffersInExportOrder(renderpasses: ShadertoyRenderPass[]): ShadertoyRenderPass[] {
  return renderpasses.filter((p) => passTypeLower(p) === "buffer");
}

export function findImagePass(renderpasses: ShadertoyRenderPass[]): ShadertoyRenderPass | undefined {
  return renderpasses.find((p) => passTypeLower(p) === "image");
}

export type PreparedMultipass = {
  commonSanitized: string;
  bodies: Record<string, string>;
  buffers: ShadertoyRenderPass[];
  image: ShadertoyRenderPass;
  title: string;
};

/**
 * Validate and prepare data for {@link ShadertoyMultipassEngine}. Applies import sanitizers to all pass bodies + common.
 */
export function prepareMultipassFromJson(data: ShadertoyJson, opts?: { sanitizeFloatF?: boolean }): PreparedMultipass {
  const rp = data.renderpass;
  if (!Array.isArray(rp) || rp.length === 0) {
    throw new Error("Shadertoy JSON has no renderpass array");
  }
  const image = findImagePass(rp);
  if (!image) {
    throw new Error("Shadertoy JSON has no image pass");
  }
  const buffers = buffersInExportOrder(rp);
  const commonRaw = collectCommonCode(rp);
  const sanitize = (src: string) => {
    let s = sanitizeUserGlsl(src);
    s = normalizePreprocessorSpacing(s);
    if (opts?.sanitizeFloatF !== false) {
      s = stripInvalidFloatSuffix(s);
    }
    return s;
  };
  const commonSanitized = commonRaw.length > 0 ? sanitize(commonRaw) : "";
  const bodies: Record<string, string> = {};
  for (const p of rp) {
    const t = passTypeLower(p);
    if (t === "buffer" || t === "image") {
      const name = p.name ?? String(t);
      bodies[name] = sanitize(p.code ?? "");
    }
  }
  const title = (data.info?.name ?? data.info?.id ?? "Shadertoy import").trim() || "Shadertoy import";
  return { commonSanitized, bodies, buffers, image, title };
}

export function parseShadertoyJson(text: string): ShadertoyJson {
  try {
    return JSON.parse(text) as ShadertoyJson;
  } catch {
    throw new Error("Invalid JSON");
  }
}
