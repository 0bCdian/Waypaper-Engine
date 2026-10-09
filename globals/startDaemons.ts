import { spawn } from "child_process";
import { request as httpRequest } from "node:http";
import { access, unlink } from "node:fs/promises";
import { daemonPath, logger, isDebugMode } from "./setup";
import { configReader } from "./configReader";
import { waitUntilHealthy } from "./waitUntilHealthy";

// Must match daemon/internal/handler/health.go MonitorStackVersion.
const MIN_MONITOR_STACK_VERSION = 2;

// Get socket path from TOML configuration
const WAYPAPER_ENGINE_SOCKET_PATH = configReader.getSocketPath();

export async function initWaypaperDaemon() {
  try {
    // Clean up any existing socket file and processes
    try {
      await access(WAYPAPER_ENGINE_SOCKET_PATH);
      logger.info("Found existing socket file, cleaning up...");
      // Try to connect to existing daemon first
      try {
        const health = await testConnection();
        const isDev = process.env.NODE_ENV === "development";
        const ver = health.monitor_stack_version;
        const stale = isDev && (typeof ver !== "number" || ver < MIN_MONITOR_STACK_VERSION);
        if (stale) {
          logger.info(
            { monitor_stack_version: ver },
            "Development mode: replacing daemon with outdated monitor discovery ABI",
          );
          try {
            await requestShutdown(WAYPAPER_ENGINE_SOCKET_PATH);
          } catch (err) {
            logger.debug({ err }, "Graceful shutdown request failed; removing socket anyway");
          }
          try {
            await unlink(WAYPAPER_ENGINE_SOCKET_PATH);
          } catch (err) {
            logger.debug({ err }, "Could not remove stale socket");
          }
          // Fall through to spawn a fresh daemon below.
        } else {
          logger.info("Existing daemon is responsive, using it");
          return; // Use existing daemon
        }
      } catch (error) {
        logger.info("Existing daemon is not responsive, cleaning up socket");
        await unlink(WAYPAPER_ENGINE_SOCKET_PATH);
      }
    } catch (error) {
      // Socket doesn't exist, proceed to start daemon
      logger.info("No existing socket file found");
    }

    const daemonArgs = isDebugMode ? ["-l", "debug"] : [];
    logger.info(`Starting waypaper-daemon at: ${daemonPath} ${daemonArgs.join(" ")}`);

    const output = spawn(daemonPath, daemonArgs, {
      stdio: "ignore",
      shell: true,
      detached: true,
      env: { ...process.env },
    });
    output.unref();

    logger.info(`Daemon process spawned with PID: ${output.pid}`);

    output.on("error", (error) => {
      logger.error({ err: error }, "Go daemon spawn error");
    });

    output.on("exit", (code, signal) => {
      logger.error(`Go daemon exited with code ${code}, signal ${signal}`);
    });

    try {
      await waitUntilHealthy(() => healthCheck(WAYPAPER_ENGINE_SOCKET_PATH), {
        intervalMs: 50,
        deadlineMs: 10_000,
      });
    } catch (error) {
      if (!output.killed) output.kill("SIGTERM");
      throw new Error("Daemon failed to become ready within 10s", { cause: error });
    }

    logger.info("Waypaper daemon started successfully");
  } catch (error) {
    logger.error({ err: error }, "Failed to start waypaper-daemon");
    throw new Error(
      `Could not start waypaper-daemon: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

type HealthzBody = {
  status?: string;
  monitor_stack_version?: number;
};

/** An existing socket may belong to a daemon that is still starting, so give it a moment. */
function testConnection(): Promise<HealthzBody> {
  return waitUntilHealthy(() => healthCheck(WAYPAPER_ENGINE_SOCKET_PATH), {
    intervalMs: 50,
    deadlineMs: 1000,
  });
}

async function healthCheck(socketPath: string): Promise<HealthzBody> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath,
        path: "/healthz",
        method: "GET",
        headers: { Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const body = JSON.parse(data) as HealthzBody;
              if (body.status === "ok") {
                resolve(body);
                return;
              }
            } catch {
              // fall through
            }
          }
          reject(new Error(`Health check failed: HTTP ${res.statusCode}`));
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(500, () => {
      req.destroy();
      reject(new Error("Health check timeout"));
    });
    req.end();
  });
}

function requestShutdown(socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath,
        path: "/shutdown",
        method: "POST",
        headers: { "Content-Length": "0" },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        reject(new Error(`shutdown failed: HTTP ${res.statusCode}`));
      },
    );
    req.on("error", (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("shutdown request timeout"));
    });
    req.end();
  });
}
