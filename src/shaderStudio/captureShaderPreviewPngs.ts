import { ShaderWallEngine } from "./shaderWallEngine";
import type { PreparedMultipass } from "./shadertoyImport";
import { ShadertoyMultipassEngine } from "./shadertoyMultipassEngine";
import {
  DEFAULT_PREVIEW_DT,
  DEFAULT_PREVIEW_FRAME_COUNT,
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_PREVIEW_WIDTH,
  FIXED_PREVIEW_IDATE,
  NEUTRAL_SHADERTOY_MOUSE,
} from "./shaderPreviewSchedule";

/** Hard cap for IPC / ffmpeg staging. */
export const MAX_PREVIEW_FRAMES = 90;

export type ShaderPreviewCaptureOpts = {
  width?: number;
  height?: number;
  frameCount?: number;
  dt?: number;
};

function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((b) => new Uint8Array(b));
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("canvas.toBlob returned null");
  return blobToUint8(blob);
}

/**
 * Renders offscreen at fixed resolution with deterministic time + neutral input, returns PNG bytes per frame.
 * Returns null if WebGL init or compile fails.
 */
export async function captureShaderPreviewPngs(
  opts: { mode: "single"; shader: string } | { mode: "multipass"; prepared: PreparedMultipass },
  captureOpts?: ShaderPreviewCaptureOpts,
): Promise<Uint8Array[] | null> {
  const w = captureOpts?.width ?? DEFAULT_PREVIEW_WIDTH;
  const h = captureOpts?.height ?? DEFAULT_PREVIEW_HEIGHT;
  const frameCount = Math.min(
    MAX_PREVIEW_FRAMES,
    Math.max(1, captureOpts?.frameCount ?? DEFAULT_PREVIEW_FRAME_COUNT),
  );
  const dt = captureOpts?.dt ?? DEFAULT_PREVIEW_DT;

  const canvas = document.createElement("canvas");
  const out: Uint8Array[] = [];

  if (opts.mode === "single") {
    const eng = new ShaderWallEngine(canvas, {
      wallpaperMouse: false,
      preserveDrawingBuffer: true,
    });
    if (!eng.init()) {
      eng.dispose();
      return null;
    }
    eng.setFixedBackingSize(w, h);
    const cr = eng.compile(opts.shader);
    if (!cr.ok) {
      eng.dispose();
      return null;
    }
    eng.resetTime();
    for (let i = 0; i < frameCount; i++) {
      eng.stepDeterministicFrame({
        time: i * dt,
        dt,
        mouse: NEUTRAL_SHADERTOY_MOUSE,
        dateVec: FIXED_PREVIEW_IDATE,
      });
      out.push(await canvasToPngBytes(canvas));
    }
    eng.dispose();
    return out;
  }

  const eng = new ShadertoyMultipassEngine(canvas, {
    preserveDrawingBuffer: true,
  });
  if (!eng.init()) {
    eng.dispose();
    return null;
  }
  eng.setFixedBackingSize(w, h);
  const cr = eng.compile(opts.prepared);
  if (!cr.ok) {
    eng.dispose();
    return null;
  }
  eng.resetTime();
  for (let i = 0; i < frameCount; i++) {
    eng.stepDeterministicFrame({
      time: i * dt,
      dt,
      mouse: NEUTRAL_SHADERTOY_MOUSE,
      dateVec: FIXED_PREVIEW_IDATE,
    });
    out.push(await canvasToPngBytes(canvas));
  }
  eng.dispose();
  return out;
}
