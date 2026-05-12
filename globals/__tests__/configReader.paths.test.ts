import { describe, expect, it } from "vitest";

import { waypaperDaemonDevBuildCandidates } from "../configReader";

describe("waypaperDaemonDevBuildCandidates", () => {
  it("prefers waypaper-engine layout when cwd is waypaper-engine", () => {
    const cwd = "/home/dev/waypaper-engine";
    expect(waypaperDaemonDevBuildCandidates(cwd)[0]).toBe(
      "/home/dev/waypaper-engine/daemon/build/waypaper-daemon",
    );
  });

  it("includes nested waypaper-engine when cwd is monorepo root", () => {
    const cwd = "/home/dev/waypaper";
    expect(waypaperDaemonDevBuildCandidates(cwd)).toContain(
      "/home/dev/waypaper/waypaper-engine/daemon/build/waypaper-daemon",
    );
  });
});
