// @vitest-environment node
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ffmpegPngSequenceToAnimatedWebp, resolveFFmpeg } from "./ffmpegWebp";

/** 1×1 RGBA PNG */
const tinyPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("ffmpegWebp", () => {
  it("resolveFFmpeg returns a string", () => {
    expect(typeof resolveFFmpeg()).toBe("string");
  });

  it("encodes two PNGs to animated WebP when ffmpeg is available", async () => {
    const ffmpeg = resolveFFmpeg();
    if (!ffmpeg) return;

    const dir = await mkdtemp(join(tmpdir(), "waypaper-ffwebp-test-"));
    try {
      await writeFile(join(dir, "preview-0001.png"), tinyPng);
      await writeFile(join(dir, "preview-0002.png"), tinyPng);
      const out = join(dir, "out.webp");
      const r = ffmpegPngSequenceToAnimatedWebp(ffmpeg, dir, 2, 12, out);
      expect(r.ok).toBe(true);
      const magic = (await readFile(out)).subarray(0, 4).toString("ascii");
      expect(magic).toBe("RIFF");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
