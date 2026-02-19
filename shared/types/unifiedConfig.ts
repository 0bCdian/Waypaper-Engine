// Unified configuration types matching the new Go daemon HTTP API
export type {
	AppConfig,
	DaemonConfig,
	SwwwConfig,
	BackendSection,
	MonitorsConfig,
	WallhavenConfig,
	UnifiedConfig,
} from "../../electron/daemon-go-types";

// Configuration change event - now reports affected sections
export interface ConfigChangeEvent {
	sections: string[];
}

// Configuration section types for form handling
export type ConfigSection = "app" | "daemon" | "backend" | "monitors" | "wallhaven";
