// Type-safe IPC types re-exported from canonical daemon types
export type {
  Monitor,
  MonitorMode,
  AppConfig,
  DaemonConfig,
  MonitorsConfig,
  BackendSection as BackendConfig,
  SwwwConfig,
  HyprpaperConfig,
  UnifiedConfig,
} from "../../electron/daemon-go-types";

// Partial configuration type for updates
import type { UnifiedConfig } from "../../electron/daemon-go-types";

export type PartialConfig = {
  [K in keyof UnifiedConfig]?: Partial<UnifiedConfig[K]>;
};
