// Legacy contracts file - all types now defined in electron/daemon-go-types.ts
// Re-export from canonical source for backward compatibility

export type {
	Monitor as MonitorContract,
	Image as ImageContract,
	Playlist as PlaylistContract,
	PlaylistConfiguration as PlaylistConfigurationContract,
	UnifiedConfig as UnifiedConfigContract,
	AppConfig as AppConfigContract,
	DaemonConfig as DaemonConfigContract,
	SwwwConfig as SwwwConfigContract,
	BackendSection as BackendConfigContract,
	MonitorsConfig as MonitorsConfigContract,
} from "../../../electron/daemon-go-types";

export type { MonitorSelection as MonitorSelectionContract } from "../monitor";
