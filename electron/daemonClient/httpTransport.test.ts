// @vitest-environment node
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpTransport } from "./httpTransport";

describe("HttpTransport readiness gate", () => {
  let dir: string;
  let socketPath: string;
  let server: Server;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "wp-transport-"));
    socketPath = join(dir, "d.sock");
    server = createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end('{"status":"ok"}');
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });

  it("holds requests until the daemon is ready, then sends them", async () => {
    let markReady!: () => void;
    const transport = new HttpTransport(socketPath);
    transport.holdUntil(new Promise<void>((resolve) => (markReady = resolve)));

    let settled = false;
    const pending = transport.request("GET", "/healthz").finally(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(settled).toBe(false);

    markReady();
    await expect(pending).resolves.toEqual({ status: "ok" });
  });

  it("fails held requests when the daemon never starts", async () => {
    const transport = new HttpTransport(socketPath);
    transport.holdUntil(Promise.reject(new Error("deadline")));

    await expect(transport.request("GET", "/healthz")).rejects.toThrow("daemon did not start");
  });
});
