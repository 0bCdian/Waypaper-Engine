// SSE Event types matching daemon/API_CONTRACT.md
export type {
	EventType,
	ProcessingStartedPayload,
	ImageProcessedPayload,
	ImageErrorPayload,
	ProcessingCompletePayload,
	WallpaperChangedPayload,
	PlaylistEventPayload,
	PlaylistImageChangedPayload,
	MonitorEventPayload,
	ConfigChangedPayload,
} from "../../electron/daemon-go-types";

// Re-export EventType as DaemonEventType for backward compatibility
export type { EventType as DaemonEventType } from "../../electron/daemon-go-types";

// Utility types for event handlers
export type DaemonEventHandler<T = unknown> = (payload: T) => void;
