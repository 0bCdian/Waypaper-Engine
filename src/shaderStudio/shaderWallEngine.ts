import {
  buildFragmentShader,
  remapShaderErrors,
  vertexSource,
  type GlVersion,
} from "./glslPrefix";

export type ShaderWallLogKind = "ok" | "err" | "info";

export type ShaderWallEngineOptions = {
  /** When true, mouse uses window dimensions (wallpaper-style). */
  wallpaperMouse?: boolean;
};

export class ShaderWallEngine {
  private canvas: HTMLCanvasElement;
  private opts: ShaderWallEngineOptions;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private isGL2 = false;
  private quadBuf: WebGLBuffer | null = null;
  private program: WebGLProgram | null = null;
  private uniCache: Record<string, WebGLUniformLocation | null> = {};
  private defaultTex2D: (WebGLTexture | null)[] = [null, null, null, null];
  private defaultTexCube: (WebGLTexture | null)[] = [null, null, null, null];
  private currentCubeChans: boolean[] = [false, false, false, false];
  private isPlaying = true;
  private startMs = 0;
  private pausedSecs = 0;
  private pauseStart = 0;
  private frameIdx = 0;
  private lastNow = 0;
  private deltaT = 0;
  private rafId: number | null = null;
  private resizeNeeded = true;
  private resizeObserver: ResizeObserver | null = null;
  private mouse = { x: 0, y: 0, cx: 0, cy: 0, down: false, click: false };
  private boundFrame: (now: number) => void;
  private onDocMouseMove: (e: MouseEvent) => void;
  private onDocMouseDown: (e: MouseEvent) => void;
  private onDocMouseUp: () => void;

  constructor(canvas: HTMLCanvasElement, opts: ShaderWallEngineOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.boundFrame = this.frame.bind(this);
    this.onDocMouseMove = (e: MouseEvent) => {
      if (!this.opts.wallpaperMouse) return;
      this.mouse.x = e.clientX / window.innerWidth;
      this.mouse.y = e.clientY / window.innerHeight;
    };
    this.onDocMouseDown = (e: MouseEvent) => {
      if (!this.opts.wallpaperMouse) return;
      this.mouse.x = this.mouse.cx = e.clientX / window.innerWidth;
      this.mouse.y = this.mouse.cy = e.clientY / window.innerHeight;
      this.mouse.down = true;
      this.mouse.click = true;
    };
    this.onDocMouseUp = () => {
      if (!this.opts.wallpaperMouse) return;
      this.mouse.down = false;
    };
  }

  init(): boolean {
    const opts = {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    };
    const ctx2 = this.canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null;
    if (ctx2) {
      this.gl = ctx2;
      this.isGL2 = true;
    } else {
      this.gl =
        (this.canvas.getContext("webgl", opts) as WebGLRenderingContext | null) ||
        (this.canvas.getContext("experimental-webgl", opts) as WebGLRenderingContext | null);
      this.isGL2 = false;
    }
    if (!this.gl) return false;

    const gl = this.gl;
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      const t2 = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      this.defaultTex2D[i] = t2;

      const tc = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tc);
      for (let face = 0; face < 6; face++) {
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 255]),
        );
      }
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.defaultTexCube[i] = tc;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeNeeded = true;
    });
    this.resizeObserver.observe(this.canvas);

    if (this.opts.wallpaperMouse) {
      document.addEventListener("mousemove", this.onDocMouseMove);
      document.addEventListener("mousedown", this.onDocMouseDown);
      document.addEventListener("mouseup", this.onDocMouseUp);
    } else {
      this.canvas.addEventListener("mousemove", this.onCanvasMouseMove);
      this.canvas.addEventListener("mousedown", this.onCanvasMouseDown);
      this.canvas.addEventListener("mouseup", this.onCanvasMouseUp);
      this.canvas.addEventListener("mouseleave", this.onCanvasMouseLeave);
    }

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

  glVersion(): GlVersion {
    return this.isGL2 ? "webgl2" : "webgl1";
  }

  compile(userCode: string): { ok: true } | { ok: false; message: string } {
    const gl = this.gl;
    if (!gl) return { ok: false, message: "WebGL not initialized" };

    const trimmed = userCode.trim();
    if (!trimmed) return { ok: false, message: "Empty shader" };

    const { source, prefixLineCount, cubeChannels } = buildFragmentShader(trimmed, this.isGL2);
    this.currentCubeChans = cubeChannels;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
      this.uniCache = {};
    }

    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    try {
      vs = this.compileShader(gl.VERTEX_SHADER, vertexSource(this.isGL2));
      if (!vs) return { ok: false, message: "Vertex shader failed" };
      fs = this.compileShader(gl.FRAGMENT_SHADER, source);
      if (!fs) {
        gl.deleteShader(vs);
        return { ok: false, message: "Fragment compile failed" };
      }
    } catch (e) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      const msg = remapShaderErrors(String(e), prefixLineCount);
      return { ok: false, message: msg };
    }

    const p = gl.createProgram();
    if (!p) {
      gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return { ok: false, message: "createProgram failed" };
    }
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? "";
      gl.deleteProgram(p);
      return { ok: false, message: remapShaderErrors("Link: " + log, prefixLineCount) };
    }
    this.program = p;
    this.uniCache = {};
    return { ok: true };
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s) ?? "";
      gl.deleteShader(s);
      throw info;
    }
    return s;
  }

  private uni(name: string): WebGLUniformLocation | null {
    const gl = this.gl;
    if (!gl || !this.program) return null;
    if (this.uniCache[name] === undefined) {
      this.uniCache[name] = gl.getUniformLocation(this.program, name);
    }
    return this.uniCache[name] ?? null;
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

  private getTimeSecs(): number {
    if (!this.isPlaying) return this.pauseStart;
    return (performance.now() - this.startMs) / 1000 - this.pausedSecs;
  }

  private syncCanvasSize(): void {
    const gl = this.gl;
    if (!gl) return;
    const pr = window.devicePixelRatio || 1;
    const dw = Math.floor(this.canvas.clientWidth * pr);
    const dh = Math.floor(this.canvas.clientHeight * pr);
    if (this.canvas.width !== dw || this.canvas.height !== dh) {
      this.canvas.width = dw;
      this.canvas.height = dh;
      gl.viewport(0, 0, dw, dh);
    }
    this.resizeNeeded = false;
  }

  private frame(now: number): void {
    this.rafId = requestAnimationFrame(this.boundFrame);
    if (this.resizeNeeded) this.syncCanvasSize();

    const gl = this.gl;
    if (!gl || !this.program) return;
    if (!this.isPlaying) {
      this.lastNow = now;
      return;
    }

    this.deltaT = this.lastNow > 0 ? (now - this.lastNow) / 1000 : 0;
    this.lastNow = now;

    const t = this.getTimeSecs();
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    const aPos = gl.getAttribLocation(this.program, "_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const W = this.canvas.width;
    const H = this.canvas.height;
    const uRes = this.uni("iResolution");
    const uTime = this.uni("iTime");
    const uDelta = this.uni("iTimeDelta");
    const uFrame = this.uni("iFrame");
    const uSample = this.uni("iSampleRate");
    const uMouse = this.uni("iMouse");
    const uDate = this.uni("iDate");
    if (uRes) gl.uniform3f(uRes, W, H, W / H);
    if (uTime) gl.uniform1f(uTime, t);
    if (uDelta) gl.uniform1f(uDelta, this.deltaT);
    if (uFrame) gl.uniform1i(uFrame, this.frameIdx);
    if (uSample) gl.uniform1f(uSample, 44100);

    const mx = this.mouse.x * W;
    const my = H - this.mouse.y * H;
    const mcx = this.mouse.cx * W;
    const mcy = H - this.mouse.cy * H;
    if (uMouse) {
      gl.uniform4f(
        uMouse,
        this.mouse.down ? mx : 0.0,
        this.mouse.down ? my : 0.0,
        this.mouse.down ? Math.abs(mcx) : -Math.abs(mcx),
        this.mouse.click ? Math.abs(mcy) : -Math.abs(mcy),
      );
    }

    const d = new Date();
    if (uDate) {
      gl.uniform4f(
        uDate,
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000,
      );
    }

    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      if (this.currentCubeChans[i]) {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.defaultTexCube[i]);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, this.defaultTex2D[i]);
      }
      const loc = this.uni("iChannel" + i);
      if (loc) gl.uniform1i(loc, i);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    if (this.opts.wallpaperMouse) {
      document.removeEventListener("mousemove", this.onDocMouseMove);
      document.removeEventListener("mousedown", this.onDocMouseDown);
      document.removeEventListener("mouseup", this.onDocMouseUp);
    } else {
      this.canvas.removeEventListener("mousemove", this.onCanvasMouseMove);
      this.canvas.removeEventListener("mousedown", this.onCanvasMouseDown);
      this.canvas.removeEventListener("mouseup", this.onCanvasMouseUp);
      this.canvas.removeEventListener("mouseleave", this.onCanvasMouseLeave);
    }
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      for (const t of this.defaultTex2D) {
        if (t) gl.deleteTexture(t);
      }
      for (const t of this.defaultTexCube) {
        if (t) gl.deleteTexture(t);
      }
      if (this.quadBuf) gl.deleteBuffer(this.quadBuf);
    }
    this.program = null;
    this.gl = null;
    this.quadBuf = null;
    this.defaultTex2D = [null, null, null, null];
    this.defaultTexCube = [null, null, null, null];
  }
}
