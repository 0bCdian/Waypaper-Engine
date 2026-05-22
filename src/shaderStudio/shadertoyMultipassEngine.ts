/**
 * WebGL2 multipass runner for Shadertoy JSON (Common + Buffer + Image).
 */

import type { PreparedMultipass } from "./shadertoyImport";
import {
  normalizeInputKind,
  type ShadertoyInput,
  type ShadertoyRenderPass,
} from "./shadertoyImport";

/** Fullscreen quad only; Shadertoy fragCoord comes from gl_FragCoord in the fragment wrapper (Y flip). */
const VERT = `#version 300 es
layout(location = 0) in vec2 _pos;
void main(){gl_Position=vec4(_pos,0.0,1.0);}`;

const FRAG_PREFIX = `precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform float iFrameRate;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 waypaper_st_out;
`;

/**
 * Shadertoy fragCoord has origin at the bottom-left (Y-up), which matches WebGL's
 * gl_FragCoord. Passing gl_FragCoord.xy directly keeps `ivec2(fragCoord)` aligned
 * with `texelFetch(channel, ivec2(P))`, which is how the Shadertoy `store`/`load`
 * convention for Buffer state (e.g. camera rotations) stays consistent across frames.
 */
const FRAG_SUFFIX = `
void main(){
  vec2 fc=gl_FragCoord.xy;
  vec4 col;
  mainImage(col,fc);
  waypaper_st_out=col;
}
`;

type BufferState = {
  pass: ShadertoyRenderPass;
  outputId: string;
  readTex: WebGLTexture | null;
  writeTex: WebGLTexture | null;
  readFbo: WebGLFramebuffer | null;
  writeFbo: WebGLFramebuffer | null;
  w: number;
  h: number;
};

type UniformSet = Record<string, WebGLUniformLocation | null> & {
  iResolution: WebGLUniformLocation | null;
  iTime: WebGLUniformLocation | null;
  iTimeDelta: WebGLUniformLocation | null;
  iFrame: WebGLUniformLocation | null;
  iFrameRate: WebGLUniformLocation | null;
  iMouse: WebGLUniformLocation | null;
  iDate: WebGLUniformLocation | null;
  iSampleRate: WebGLUniformLocation | null;
  iChannel0: WebGLUniformLocation | null;
  iChannel1: WebGLUniformLocation | null;
  iChannel2: WebGLUniformLocation | null;
  iChannel3: WebGLUniformLocation | null;
};

function getUniforms(gl: WebGL2RenderingContext, p: WebGLProgram): UniformSet {
  const u = (n: string) => gl.getUniformLocation(p, n);
  const out: UniformSet = {
    iResolution: u("iResolution"),
    iTime: u("iTime"),
    iTimeDelta: u("iTimeDelta"),
    iFrame: u("iFrame"),
    iFrameRate: u("iFrameRate"),
    iMouse: u("iMouse"),
    iDate: u("iDate"),
    iSampleRate: u("iSampleRate"),
    iChannel0: u("iChannel0"),
    iChannel1: u("iChannel1"),
    iChannel2: u("iChannel2"),
    iChannel3: u("iChannel3"),
  };
  for (let i = 0; i < 4; i++) {
    (out as Record<string, WebGLUniformLocation | null>)[`iChannelResolution[${i}]`] = u(
      `iChannelResolution[${i}]`,
    );
    (out as Record<string, WebGLUniformLocation | null>)[`iChannelTime[${i}]`] = u(
      `iChannelTime[${i}]`,
    );
  }
  return out;
}

function clearFboToBlack(
  gl: WebGL2RenderingContext,
  fbo: WebGLFramebuffer,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

/**
 * Shadertoy buffer passes render to full-precision float textures (RGBA32F), not 8-bit UNORM.
 * NEAREST matches typical buffer feedback / texelFetch-style use and avoids OES_texture_float_linear.
 */
function makeBufferTexRgba32f(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

function makeFbo(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete: ${st}`);
  return fb;
}

function blackTex(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  const one = new Uint8Array([0, 0, 0, 255]);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, one);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

type KeyboardState = {
  tex: WebGLTexture;
  w: number;
  h: number;
  keys: Set<number>;
  data: Uint8Array;
  gl: WebGL2RenderingContext;
};

function keyboardTex(gl: WebGL2RenderingContext): KeyboardState {
  const w = 256;
  const h = 2;
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const z = new Uint8Array(w * h * 4);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, z);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { tex: t, w, h, keys: new Set(), data: z, gl };
}

function updateKeyboard(kb: KeyboardState): void {
  const { w, h, data, keys } = kb;
  data.fill(0);
  for (const k of keys) {
    if (k >= 0 && k < w) {
      data[k * 4] = 255;
    }
  }
  const gl = kb.gl;
  gl.bindTexture(gl.TEXTURE_2D, kb.tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function setGlobals(
  gl: WebGL2RenderingContext,
  uni: UniformSet,
  w: number,
  h: number,
  time: number,
  dt: number,
  frame: number,
  mouse: [number, number, number, number],
  dateVec: [number, number, number, number],
): void {
  if (uni.iResolution) gl.uniform3f(uni.iResolution, w, h, 1);
  if (uni.iTime) gl.uniform1f(uni.iTime, time);
  if (uni.iTimeDelta) gl.uniform1f(uni.iTimeDelta, dt);
  if (uni.iFrame) gl.uniform1i(uni.iFrame, frame);
  if (uni.iFrameRate) gl.uniform1f(uni.iFrameRate, dt > 1e-8 ? 1.0 / dt : 0);
  if (uni.iMouse) gl.uniform4f(uni.iMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
  if (uni.iDate) gl.uniform4f(uni.iDate, dateVec[0], dateVec[1], dateVec[2], dateVec[3]);
  if (uni.iSampleRate) gl.uniform1f(uni.iSampleRate, 44100);
  for (let i = 0; i < 4; i++) {
    const loc3 = (uni as Record<string, WebGLUniformLocation | null>)[`iChannelResolution[${i}]`];
    if (loc3) gl.uniform3f(loc3, 1, 1, 1);
    const loc1 = (uni as Record<string, WebGLUniformLocation | null>)[`iChannelTime[${i}]`];
    if (loc1) gl.uniform1f(loc1, 0);
  }
}

function setChannelResolutions(
  gl: WebGL2RenderingContext,
  p: WebGLProgram,
  res: [number, number, number][],
): void {
  for (let i = 0; i < 4; i++) {
    const loc = gl.getUniformLocation(p, `iChannelResolution[${i}]`);
    if (loc) gl.uniform3f(loc, res[i][0], res[i][1], res[i][2]);
  }
}

function bindChannel(
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  unit: number,
  tex: WebGLTexture,
): void {
  if (!loc) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc, unit);
}

function channelSamplerLoc(uni: UniformSet, ch: number): WebGLUniformLocation | null {
  switch (ch) {
    case 0:
      return uni.iChannel0;
    case 1:
      return uni.iChannel1;
    case 2:
      return uni.iChannel2;
    case 3:
      return uni.iChannel3;
    default:
      return null;
  }
}

function resolveInputs(
  pass: ShadertoyRenderPass,
  idToState: Record<string, BufferState>,
  phase: "buffer" | "image",
  kb: KeyboardState,
  black: WebGLTexture,
  dummyRes: [number, number, number],
): { channels: WebGLTexture[]; res: [number, number, number][] } {
  const channels: WebGLTexture[] = [black, black, black, black];
  const res: [number, number, number][] = [dummyRes, dummyRes, dummyRes, dummyRes];
  for (const inp of pass.inputs ?? []) {
    const ch = inp.channel | 0;
    if (ch < 0 || ch > 3) continue;
    const kind = normalizeInputKind(inp as ShadertoyInput);
    if (kind === "keyboard") {
      channels[ch] = kb.tex;
      res[ch] = [kb.w, kb.h, 1];
    } else if (kind === "buffer") {
      const id = inp.id;
      if (!id) continue;
      const st = idToState[id];
      if (!st) continue;
      const t = phase === "buffer" ? st.readTex! : st.writeTex!;
      channels[ch] = t;
      res[ch] = [st.w, st.h, 1];
    } else {
      channels[ch] = black;
      res[ch] = [1, 1, 1];
    }
  }
  return { channels, res };
}

export type ShadertoyMultipassEngineOptions = {
  preserveDrawingBuffer?: boolean;
};

export class ShadertoyMultipassEngine {
  private canvas: HTMLCanvasElement;
  private opts: ShadertoyMultipassEngineOptions;
  private gl: WebGL2RenderingContext | null = null;
  private quadBuf: WebGLBuffer | null = null;
  private programs: { buffers: WebGLProgram[]; image: WebGLProgram | null } = {
    buffers: [],
    image: null,
  };
  private uniBuf: UniformSet[] = [];
  private uniImg: UniformSet | null = null;
  private bufStates: BufferState[] = [];
  private idToState: Record<string, BufferState> = {};
  private prepared: PreparedMultipass | null = null;
  private kb: KeyboardState | null = null;
  private black: WebGLTexture | null = null;
  private readonly dummyRes: [number, number, number] = [1, 1, 1];
  private rafId: number | null = null;
  private boundFrame: (now: number) => void;
  private isPlaying = true;
  private startMs = 0;
  private pausedSecs = 0;
  private pauseStart = 0;
  private frameIdx = 0;
  private lastNow = 0;
  private deltaT = 0;
  private resizeNeeded = true;
  private resizeObserver: ResizeObserver | null = null;
  private fixedBackingSize: { w: number; h: number } | null = null;
  private mouse = { x: 0, y: 0, cx: 0, cy: 0, down: false, click: false };
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, opts: ShadertoyMultipassEngineOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.boundFrame = this.frame.bind(this);
    this.onKeyDown = (e: KeyboardEvent) => {
      this.kb?.keys.add(e.keyCode);
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      this.kb?.keys.delete(e.keyCode);
    };
  }

  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: this.opts.preserveDrawingBuffer ?? false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return false;
    this.gl = gl;
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeNeeded = true;
    });
    this.resizeObserver.observe(this.canvas);

    this.canvas.addEventListener("mousemove", this.onCanvasMouseMove);
    this.canvas.addEventListener("mousedown", this.onCanvasMouseDown);
    this.canvas.addEventListener("mouseup", this.onCanvasMouseUp);
    this.canvas.addEventListener("mouseleave", this.onCanvasMouseLeave);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.startMs = performance.now();
    return true;
  }

  private normXY(x: number, y: number, rect: DOMRect): [number, number] {
    return [(x - rect.left) / rect.width, (y - rect.top) / rect.height];
  }

  private onCanvasMouseMove = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    [this.mouse.x, this.mouse.y] = this.normXY(e.clientX, e.clientY, r);
  };

  private onCanvasMouseDown = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    [this.mouse.x, this.mouse.y] = this.normXY(e.clientX, e.clientY, r);
    [this.mouse.cx, this.mouse.cy] = [this.mouse.x, this.mouse.y];
    this.mouse.down = true;
    this.mouse.click = true;
  };

  private onCanvasMouseUp = (): void => {
    this.mouse.down = false;
  };

  private onCanvasMouseLeave = (): void => {
    this.mouse.down = false;
  };

  compile(prepared: PreparedMultipass): { ok: true } | { ok: false; message: string } {
    const gl = this.gl;
    if (!gl) return { ok: false, message: "WebGL2 not initialized" };
    this.disposeGpuPrograms();
    this.prepared = prepared;

    if (!gl.getExtension("EXT_color_buffer_float")) {
      return {
        ok: false,
        message:
          "Multipass buffer passes need EXT_color_buffer_float (RGBA32F render targets), like Shadertoy. This GPU or browser build does not expose it.",
      };
    }

    // Common tab is prepended to every buffer + image fragment.
    const commonBlock = prepared.commonSanitized.trim();
    const commonPrefix = commonBlock.length > 0 ? `${commonBlock}\n` : "";

    try {
      const buffers = prepared.buffers;
      for (let i = 0; i < buffers.length; i++) {
        const p = buffers[i]!;
        const name = p.name ?? "buffer";
        const body = prepared.bodies[name] ?? "";
        const frag = `#version 300 es\n${FRAG_PREFIX}\n${commonPrefix}${body}\n${FRAG_SUFFIX}`;
        const prog = this.link(gl, frag, `buffer:${name}`);
        this.programs.buffers.push(prog);
        this.uniBuf.push(getUniforms(gl, prog));
      }
      const imgName = prepared.image.name ?? "image";
      const imgBody = prepared.bodies[imgName] ?? "";
      const imgFrag = `#version 300 es\n${FRAG_PREFIX}\n${commonPrefix}${imgBody}\n${FRAG_SUFFIX}`;
      this.programs.image = this.link(gl, imgFrag, `image:${imgName}`);
      this.uniImg = getUniforms(gl, this.programs.image);
    } catch (e) {
      this.disposeGpuPrograms();
      return { ok: false, message: String(e instanceof Error ? e.message : e) };
    }

    this.bufStates = [];
    this.idToState = {};
    for (let i = 0; i < prepared.buffers.length; i++) {
      const p = prepared.buffers[i]!;
      const outs = p.outputs ?? [];
      const oid = outs[0]?.id;
      if (!oid) {
        this.disposeGpuPrograms();
        return {
          ok: false,
          message: `Buffer pass "${p.name ?? i}" has no output id`,
        };
      }
      const st: BufferState = {
        pass: p,
        outputId: oid,
        readTex: null,
        writeTex: null,
        readFbo: null,
        writeFbo: null,
        w: 0,
        h: 0,
      };
      this.bufStates.push(st);
      this.idToState[oid] = st;
    }

    if (!this.kb) {
      this.kb = keyboardTex(gl);
      this.kb.gl = gl;
    }
    if (!this.black) this.black = blackTex(gl);

    this.frameIdx = 0;
    this.lastNow = 0;
    this.resizeNeeded = true;
    this.syncCanvasSize();
    if (this.bufStates.length > 0) {
      this.allocTargets();
    }
    return { ok: true };
  }

  private link(gl: WebGL2RenderingContext, fragSrc: string, label: string): WebGLProgram {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(vs) ?? "";
      gl.deleteShader(vs);
      throw new Error(`${label} vertex: ${log}`);
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fs) ?? "";
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`${label} fragment: ${log}`);
    }
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? "";
      gl.deleteProgram(p);
      throw new Error(`${label} link: ${log}`);
    }
    return p;
  }

  private disposeGpuPrograms(): void {
    const gl = this.gl;
    if (gl) {
      for (const p of this.programs.buffers) gl.deleteProgram(p);
      if (this.programs.image) gl.deleteProgram(this.programs.image);
    }
    this.programs = { buffers: [], image: null };
    this.uniBuf = [];
    this.uniImg = null;
    for (const st of this.bufStates) {
      if (gl && st.readTex) {
        gl.deleteTexture(st.readTex);
        gl.deleteTexture(st.writeTex);
        gl.deleteFramebuffer(st.readFbo);
        gl.deleteFramebuffer(st.writeFbo);
      }
    }
    this.bufStates = [];
    this.idToState = {};
  }

  startLoop(): void {
    if (this.rafId != null) return;
    this.lastNow = 0;
    this.rafId = requestAnimationFrame(this.boundFrame);
  }

  stopLoop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setPlaying(playing: boolean): void {
    if (playing === this.isPlaying) return;
    this.isPlaying = playing;
    if (!playing) {
      this.pauseStart = this.getTimeSecs();
    } else {
      this.startMs = performance.now() - this.pauseStart * 1000;
      this.pausedSecs = 0;
    }
  }

  isRunning(): boolean {
    return this.isPlaying;
  }

  resetTime(): void {
    this.startMs = performance.now();
    this.pausedSecs = 0;
    this.pauseStart = 0;
    this.frameIdx = 0;
    this.lastNow = 0;
  }

  setFixedBackingSize(width: number | null, height: number | null): void {
    if (width == null || height == null) {
      this.fixedBackingSize = null;
      this.resizeNeeded = true;
      return;
    }
    this.fixedBackingSize = {
      w: Math.max(2, Math.floor(width)),
      h: Math.max(2, Math.floor(height)),
    };
    this.resizeNeeded = true;
  }

  /**
   * One multipass tick with explicit uniforms (no rAF). Clears keyboard state each step.
   */
  stepDeterministicFrame(opts: {
    time: number;
    dt: number;
    mouse?: [number, number, number, number];
    dateVec?: [number, number, number, number];
  }): void {
    if (this.resizeNeeded) this.syncCanvasSize();
    const gl = this.gl;
    const prepared = this.prepared;
    const imgProg = this.programs.image;
    const black = this.black;
    const kb = this.kb;
    if (!gl || !prepared || !imgProg || !black || !kb) return;

    kb.keys.clear();
    updateKeyboard(kb);

    const mouseVec = opts.mouse ?? [0, 0, -1, -1];
    const dateVec = opts.dateVec ?? [1970, 1, 1, 0];
    const dt = Math.max(1e-6, opts.dt);
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W < 2 || H < 2) return;

    this.runMultipassDraw(
      gl,
      prepared,
      imgProg,
      black,
      kb,
      opts.time,
      dt,
      this.frameIdx,
      mouseVec,
      dateVec,
    );
    this.frameIdx++;
  }

  private getTimeSecs(): number {
    if (!this.isPlaying) return this.pauseStart;
    return (performance.now() - this.startMs) / 1000 - this.pausedSecs;
  }

  private syncCanvasSize(): void {
    const gl = this.gl;
    if (!gl) return;
    let dw: number;
    let dh: number;
    if (this.fixedBackingSize) {
      dw = this.fixedBackingSize.w;
      dh = this.fixedBackingSize.h;
    } else {
      const pr = window.devicePixelRatio || 1;
      dw = Math.max(2, Math.floor(this.canvas.clientWidth * pr));
      dh = Math.max(2, Math.floor(this.canvas.clientHeight * pr));
    }
    if (this.canvas.width !== dw || this.canvas.height !== dh) {
      this.canvas.width = dw;
      this.canvas.height = dh;
      gl.viewport(0, 0, dw, dh);
      this.allocTargets();
    }
    this.resizeNeeded = false;
  }

  private allocTargets(): void {
    const gl = this.gl;
    if (!gl) return;
    const w = Math.max(2, this.canvas.width);
    const h = Math.max(2, this.canvas.height);
    for (const st of this.bufStates) {
      if (st.readTex) {
        gl.deleteTexture(st.readTex);
        gl.deleteTexture(st.writeTex);
        gl.deleteFramebuffer(st.readFbo);
        gl.deleteFramebuffer(st.writeFbo);
      }
      st.w = w;
      st.h = h;
      st.readTex = makeBufferTexRgba32f(gl, w, h);
      st.writeTex = makeBufferTexRgba32f(gl, w, h);
      st.readFbo = makeFbo(gl, st.readTex);
      st.writeFbo = makeFbo(gl, st.writeTex);
      clearFboToBlack(gl, st.readFbo, w, h);
      clearFboToBlack(gl, st.writeFbo, w, h);
    }
  }

  private runMultipassDraw(
    gl: WebGL2RenderingContext,
    prepared: PreparedMultipass,
    imgProg: WebGLProgram,
    black: WebGLTexture,
    kb: KeyboardState,
    time: number,
    dt: number,
    frameIndex: number,
    mouseVec: [number, number, number, number],
    dateVec: [number, number, number, number],
  ): void {
    const W = this.canvas.width;
    const H = this.canvas.height;

    for (let i = 0; i < this.programs.buffers.length; i++) {
      const prog = this.programs.buffers[i]!;
      const u = this.uniBuf[i]!;
      const st = this.bufStates[i]!;
      const pass = st.pass;
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.writeFbo);
      gl.viewport(0, 0, W, H);
      gl.useProgram(prog);
      setGlobals(gl, u, W, H, time, dt, frameIndex, mouseVec, dateVec);
      const { channels, res } = resolveInputs(
        pass,
        this.idToState,
        "buffer",
        kb,
        black,
        this.dummyRes,
      );
      setChannelResolutions(gl, prog, res);
      for (let ch = 0; ch < 4; ch++) {
        bindChannel(gl, channelSamplerLoc(u, ch), ch, channels[ch]!);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      const aPos = gl.getAttribLocation(prog, "_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(imgProg);
    const uImg = this.uniImg!;
    setGlobals(gl, uImg, W, H, time, dt, frameIndex, mouseVec, dateVec);
    const { channels: chI, res: resI } = resolveInputs(
      prepared.image,
      this.idToState,
      "image",
      kb,
      black,
      this.dummyRes,
    );
    setChannelResolutions(gl, imgProg, resI);
    for (let ch = 0; ch < 4; ch++) {
      bindChannel(gl, channelSamplerLoc(uImg, ch), ch, chI[ch]!);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    const aImg = gl.getAttribLocation(imgProg, "_pos");
    gl.enableVertexAttribArray(aImg);
    gl.vertexAttribPointer(aImg, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    for (const st of this.bufStates) {
      const tmp = st.readTex;
      st.readTex = st.writeTex;
      st.writeTex = tmp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.readFbo!);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.readTex!, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.writeFbo!);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.writeTex!, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }

  private frame(now: number): void {
    this.rafId = requestAnimationFrame(this.boundFrame);
    if (this.resizeNeeded) this.syncCanvasSize();

    const gl = this.gl;
    const prepared = this.prepared;
    const imgProg = this.programs.image;
    const black = this.black;
    const kb = this.kb;
    if (!gl || !prepared || !imgProg || !black || !kb) return;
    if (!this.isPlaying) {
      this.lastNow = now;
      return;
    }

    this.deltaT = this.lastNow > 0 ? (now - this.lastNow) / 1000 : 0;
    this.lastNow = now;

    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W < 2 || H < 2) return;

    updateKeyboard(kb);

    const time = this.getTimeSecs();
    const dt = Math.max(1e-6, this.deltaT);
    const d = new Date();
    const dateVec: [number, number, number, number] = [
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000,
    ];
    const mx = this.mouse.x * W;
    const my = H - this.mouse.y * H;
    const mcx = this.mouse.cx * W;
    const mcy = H - this.mouse.cy * H;
    const mouseVec: [number, number, number, number] = [
      this.mouse.down ? mx : 0,
      this.mouse.down ? my : 0,
      this.mouse.down ? Math.abs(mcx) : -Math.abs(mcx),
      this.mouse.click ? Math.abs(mcy) : -Math.abs(mcy),
    ];

    this.runMultipassDraw(
      gl,
      prepared,
      imgProg,
      black,
      kb,
      time,
      dt,
      this.frameIdx,
      mouseVec,
      dateVec,
    );

    this.mouse.click = false;
    this.frameIdx++;
  }

  dispose(): void {
    this.stopLoop();
    const gl = this.gl;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.removeEventListener("mousemove", this.onCanvasMouseMove);
    this.canvas.removeEventListener("mousedown", this.onCanvasMouseDown);
    this.canvas.removeEventListener("mouseup", this.onCanvasMouseUp);
    this.canvas.removeEventListener("mouseleave", this.onCanvasMouseLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);

    this.disposeGpuPrograms();

    if (gl) {
      if (this.black) gl.deleteTexture(this.black);
      if (this.kb) gl.deleteTexture(this.kb.tex);
      if (this.quadBuf) gl.deleteBuffer(this.quadBuf);
    }
    this.black = null;
    this.kb = null;
    this.quadBuf = null;
    this.gl = null;
    this.prepared = null;
  }
}
