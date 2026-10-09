import { request as httpRequest, type IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
import { logger } from "./logger";
import { configReader } from "../globals/configReader";
import type { EventType } from "./daemon-go-types";
import { ControlPlaneClient } from "./daemonClient/controlPlaneClient";
import { FoldersClient } from "./daemonClient/foldersClient";
import { HealthClient } from "./daemonClient/healthClient";
import { HttpTransport } from "./daemonClient/httpTransport";
import { ImagesClient } from "./daemonClient/imagesClient";
import { MonitorsClient } from "./daemonClient/monitorsClient";
import { PlaylistsClient } from "./daemonClient/playlistsClient";
import { WallpaperClient } from "./daemonClient/wallpaperClient";

/** Unix-socket client for the Go daemon: SSE event fan-out plus per-domain JSON route clients. */
class GoDaemonClient extends EventEmitter {
  private readonly http: HttpTransport;

  /** Control-plane routes (config, backends, activation). */
  readonly control: ControlPlaneClient;
  readonly health: HealthClient;
  readonly images: ImagesClient;
  readonly playlists: PlaylistsClient;
  readonly folders: FoldersClient;
  readonly monitors: MonitorsClient;
  readonly wallpaper: WallpaperClient;

  private sseConnection: IncomingMessage | null = null;
  private sseReconnectTimer: NodeJS.Timeout | null = null;
  private sseReconnectAttempts: number = 0;
  private sseBuffer: string = "";

  constructor(socketPath?: string) {
    super();
    const path = socketPath || configReader.getSocketPath();
    this.http = new HttpTransport(path);
    this.control = new ControlPlaneClient(this.http);
    this.health = new HealthClient(this.http);
    this.images = new ImagesClient(this.http);
    this.playlists = new PlaylistsClient(this.http);
    this.folders = new FoldersClient(this.http);
    this.monitors = new MonitorsClient(this.http);
    this.wallpaper = new WallpaperClient(this.http);
  }

  /** Every daemon request waits for `ready` (the startup handshake) instead of failing. */
  holdUntil(ready: Promise<void>): void {
    this.http.holdUntil(ready);
  }

  connectSSE(): void {
    if (this.sseConnection) {
      return;
    }

    const options = {
      socketPath: this.http.socket,
      path: "/events",
      method: "GET",
      agent: false as const,
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    };

    const req = httpRequest(options, (res) => {
      if (this.sseReconnectTimer) {
        clearTimeout(this.sseReconnectTimer);
        this.sseReconnectTimer = null;
      }
      this.sseConnection = res;
      const wasReconnect = this.sseReconnectAttempts > 0;
      this.sseReconnectAttempts = 0;
      this.sseBuffer = "";
      logger.info("SSE connection established");
      this.emit("connected");
      if (wasReconnect) {
        this.emit("sseReconnected");
      }

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        this.handleSSEData(chunk);
      });

      res.on("end", () => {
        logger.warn("SSE connection ended");
        this.sseConnection = null;
        this.emit("disconnected");
        this.scheduleSseReconnect();
      });

      res.on("error", (error) => {
        logger.error({ err: error }, "SSE connection error");
        this.sseConnection = null;
        this.emit("error", error);
        this.scheduleSseReconnect();
      });
    });

    req.on("error", (error) => {
      logger.error({ err: error }, "SSE request error");
      this.sseConnection = null;
      this.emit("error", error);
      this.scheduleSseReconnect();
    });

    req.end();
  }

  private handleSSEData(chunk: string): void {
    this.sseBuffer += chunk;
    const lines = this.sseBuffer.split("\n");

    let currentEvent = "";
    let currentData = "";

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();

      if (line === "") {
        if (currentEvent && currentData) {
          try {
            const payload = JSON.parse(currentData);
            this.emit(currentEvent as EventType, payload);
          } catch (error) {
            logger.error({ err: error, event: currentEvent }, "Failed to parse SSE event data");
          }
        }
        currentEvent = "";
        currentData = "";
      } else if (line.startsWith("event:")) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.substring(5).trim();
      }
    }

    this.sseBuffer = lines[lines.length - 1];
  }

  private scheduleSseReconnect(): void {
    if (this.sseReconnectTimer) return;
    this.sseReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, Math.min(this.sseReconnectAttempts - 1, 6)), 60000);

    if (this.sseReconnectAttempts === 1) {
      this.emit("sseDisconnected");
    }

    logger.info(`Scheduling SSE reconnect in ${delay}ms (attempt ${this.sseReconnectAttempts})`);

    this.sseReconnectTimer = setTimeout(() => {
      this.connectSSE();
    }, delay);
  }

  async connect(): Promise<void> {
    await this.health.healthCheck();
    this.connectSSE();
  }
}

export const goDaemonClient = new GoDaemonClient();
