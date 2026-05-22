import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { configReader } from "../globals/configReader";

const MARKER = "--daemon";

/** Arguments after the first `--daemon`, or null if the marker is absent. */
export function sliceArgvAfterDaemonMarker(argv: readonly string[]): string[] | null {
  const idx = argv.indexOf(MARKER);
  if (idx === -1) {
    return null;
  }
  return argv.slice(idx + 1);
}

/**
 * When argv contains `--daemon`, spawn the bundled `waypaper-daemon` detached,
 * then exit this process as soon as the child has started — Electron does not
 * stay running alongside the daemon (no `app.quit` / shutdown plumbing).
 *
 * @returns `true` if daemon forwarding was engaged — caller must **not** run
 * normal Electron startup (`requestSingleInstanceLock`, windows, etc.).
 */
export function spawnBundledDaemonAndExit(argv: string[]): boolean | never {
  const forwarded = sliceArgvAfterDaemonMarker(argv);
  if (forwarded === null) {
    return false;
  }

  const bin = configReader.getDaemonPath();
  if (!existsSync(bin)) {
    console.error(`waypaper-engine: bundled daemon not found at ${bin}`);
    process.exit(127);
  }

  const child = spawn(bin, forwarded, {
    detached: true,
    stdio: "ignore",
    env: process.env,
    shell: false,
  });

  child.once("error", (err) => {
    console.error(`waypaper-engine: failed to spawn daemon: ${err.message}`);
    process.exit(1);
  });

  child.once("spawn", () => {
    child.unref();
    process.exit(0);
  });

  return true;
}
