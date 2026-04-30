import type { BackendInfo, UnifiedConfig } from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

/** Config + named backends + activation — mirrors daemon `internal/control` HTTP surface. */
export class ControlPlaneClient {
  constructor(private readonly t: HttpTransport) {}

  async getConfig(): Promise<UnifiedConfig> {
    return this.t.request<UnifiedConfig>("GET", "/config");
  }

  async updateConfig(config: Partial<UnifiedConfig>): Promise<UnifiedConfig> {
    return this.t.request<UnifiedConfig>("PATCH", "/config", config);
  }

  async getConfigSection(section: string): Promise<unknown> {
    return this.t.request("GET", `/config/${section}`);
  }

  async updateConfigSection(section: string, data: Record<string, unknown>): Promise<unknown> {
    return this.t.request("PATCH", `/config/${section}`, data);
  }

  async getBackendConfig(name: string): Promise<Record<string, unknown>> {
    return this.t.request<Record<string, unknown>>(
      "GET",
      `/config/backends/${encodeURIComponent(name)}`,
    );
  }

  async updateBackendConfig(name: string, patch: Record<string, unknown>): Promise<void> {
    await this.t.request("PATCH", `/config/backends/${encodeURIComponent(name)}`, patch);
  }

  async getBackends(): Promise<BackendInfo[]> {
    return this.t.request<BackendInfo[]>("GET", "/backends");
  }

  async activateBackend(name: string): Promise<{ status: string; backend: string }> {
    return this.t.request<{ status: string; backend: string }>(
      "POST",
      `/backends/${encodeURIComponent(name)}/activate`,
    );
  }
}
