// Unified configuration types matching the new Go daemon HTTP API
export type {
	AppConfig,
	DaemonConfig,
	SwwwConfig,
	BackendSection,
	MonitorsConfig,
	UnifiedConfig,
} from "../../electron/daemon-go-types";

// Configuration change event - now reports affected sections
export interface ConfigChangeEvent {
	sections: string[];
}

// Configuration section types for form handling
export type ConfigSection = "app" | "daemon" | "backend" | "monitors";

// Helper types for form validation
export interface ConfigValidationError {
	section: ConfigSection;
	key: string;
	message: string;
}

export interface ConfigFormState {
	isLoading: boolean;
	isDirty: boolean;
	errors: ConfigValidationError[];
	lastSaved: number | null;
}
