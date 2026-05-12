import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { daemonPathRef } = vi.hoisted(() => ({
  daemonPathRef: { path: "" as string },
}));

vi.mock("../globals/configReader", () => ({
  configReader: {
    getDaemonPath: () => daemonPathRef.path,
  },
}));

import { spawnBundledDaemonAndExit, sliceArgvAfterDaemonMarker } from "./daemonForward";

describe("sliceArgvAfterDaemonMarker", () => {
  it("returns null when marker is absent", () => {
    expect(sliceArgvAfterDaemonMarker(["/opt/app/AppRun", "--enable-features"])).toBeNull();
  });

  it("returns args after marker", () => {
    expect(sliceArgvAfterDaemonMarker(["./Waypaper.AppImage", "--daemon", "start"])).toEqual([
      "start",
    ]);
  });

  it("returns empty array when marker is last", () => {
    expect(sliceArgvAfterDaemonMarker(["app", "--daemon"])).toEqual([]);
  });

  it("forwards daemon flags", () => {
    expect(
      sliceArgvAfterDaemonMarker(["electron", "--daemon", "start", "--log-level", "debug"]),
    ).toEqual(["start", "--log-level", "debug"]);
  });
});

describe("spawnBundledDaemonAndExit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "wp-daemon-fwd-"));
    daemonPathRef.path = join(tmpDir, "waypaper-daemon");
    writeFileSync(daemonPathRef.path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false without spawning when marker absent", () => {
    expect(spawnBundledDaemonAndExit(["/usr/bin/app"])).toBe(false);
  });

  it("returns true and exits 0 after child spawn when marker present", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    expect(spawnBundledDaemonAndExit(["./Waypaper.AppImage", "--daemon", "start"])).toBe(true);

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    exitSpy.mockRestore();
  });
});
