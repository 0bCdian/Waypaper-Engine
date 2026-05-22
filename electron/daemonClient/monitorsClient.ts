import type { Monitor } from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class MonitorsClient {
  constructor(private readonly t: HttpTransport) {}

  async getMonitors(): Promise<Monitor[]> {
    return this.t.request<Monitor[]>("GET", "/monitors");
  }

  async getMonitor(name: string): Promise<Monitor> {
    return this.t.request<Monitor>("GET", `/monitors/${encodeURIComponent(name)}`);
  }
}
