import type { DaemonInfo, HealthResponse } from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class HealthClient {
  constructor(private readonly t: HttpTransport) {}

  async healthCheck(): Promise<HealthResponse> {
    return this.t.request<HealthResponse>("GET", "/healthz");
  }

  async ping(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<DaemonInfo> {
    return this.t.request<DaemonInfo>("GET", "/info");
  }

  async getCapabilities(): Promise<{ ffmpeg_available: boolean }> {
    return this.t.request<{ ffmpeg_available: boolean }>("GET", "/capabilities");
  }

  async shutdown(): Promise<void> {
    await this.t.request("POST", "/shutdown");
  }
}
