import { ipcRenderer } from "electron";
import type { JsonStoreImage } from "../shared/types/daemon";
import type {
	ActiveMonitor,
	MonitorSelection,
	Monitor,
} from "../shared/types/monitor";
import { convertToMonitorSelection } from "../shared/types/monitor";
import type {
	RendererPlaylist,
	StoredPlaylist,
	RunningPlaylistInfo,
	ImageHistory,
	ImageInfo,
	UnifiedConfig,
	DaemonStatus,
	DaemonInfo,
	PlaylistDiagnostics,
	EventType,
} from "./daemon-go-types";

export interface GoDaemonRendererClient {
	// ============================================================================
	// SYSTEM OPERATIONS
	// ============================================================================
	ping(): Promise<boolean>;
	getInfo(): Promise<DaemonInfo>;
	getMonitors(): Promise<Monitor[]>;
	getDaemonStatus(): Promise<DaemonStatus>;
	getDiagnostics(monitorName?: string): Promise<PlaylistDiagnostics>;
	killDaemon(): Promise<void>;
	stopDaemon(): Promise<void>;

	// ============================================================================
	// PLAYLIST OPERATIONS
	// ============================================================================
	getPlaylists(): Promise<StoredPlaylist[]>;
	getPlaylist(playlistId: number): Promise<StoredPlaylist>;
	savePlaylist(playlist: RendererPlaylist): Promise<StoredPlaylist>;
	deletePlaylist(playlistName: string): Promise<void>;
	startPlaylist(
		playlistId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	stopPlaylist(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;
	pausePlaylist(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;
	resumePlaylist(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;
	nextPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	previousPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	getRunningPlaylists(): Promise<Record<string, RunningPlaylistInfo>>;

	// ============================================================================
	// IMAGE OPERATIONS
	// ============================================================================
	getImages(filters?: unknown): Promise<JsonStoreImage[]>;
	processImages(imagePaths: string[], fileNames: string[]): Promise<void>;
	deleteImages(imageIds: number[]): Promise<void>;
	upsertImage(image: ImageInfo): Promise<void>;
	getImageHistory(): Promise<ImageHistory[]>;
	processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<Record<string, string>>;

	// ============================================================================
	// CONFIGURATION OPERATIONS
	// ============================================================================
	getConfig(): Promise<UnifiedConfig>;
	setConfig(section: string, key: string, value: unknown): Promise<void>;
	setBulkConfig(config: Partial<UnifiedConfig>): Promise<void>;
	setSelectedMonitor(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	getSelectedMonitor(): Promise<MonitorSelection>;

	// ============================================================================
	// MISCELLANEOUS OPERATIONS
	// ============================================================================
	setImage(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	setImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	nextImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	previousImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
	randomImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;

	// ============================================================================
	// EVENT SUBSCRIPTION
	// ============================================================================
	subscribeToEvents(eventTypes: Array<EventType | "*">): Promise<void>;
	unsubscribeFromEvents(eventTypes: Array<EventType | "*">): Promise<void>;
	on(event: EventType, callback: (data: unknown) => void): void;
	off(event: EventType, callback: (data: unknown) => void): void;

	// ============================================================================
	// LEGACY COMPATIBILITY
	// ============================================================================
	/** @deprecated Use deleteImages instead */
	deleteImagesFromGallery(imageIds: number[]): Promise<void>;
	/** @deprecated Use nextPlaylistImage instead */
	nextImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;
	/** @deprecated Use previousPlaylistImage instead */
	previousImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void>;
	/** @deprecated Use getRunningPlaylists instead */
	getActivePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<RunningPlaylistInfo | null>;
	/** @deprecated Use getPlaylist instead */
	getPlaylistImages(playlistId: number): Promise<StoredPlaylist>;
	/** @deprecated Use setImageAcrossMonitors with mode: "clone" */
	duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void>;
}

class GoDaemonRendererClientImpl implements GoDaemonRendererClient {
	// ============================================================================
	// SYSTEM OPERATIONS
	// ============================================================================

	async ping(): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "ping");
	}

	async getInfo(): Promise<DaemonInfo> {
		return ipcRenderer.invoke("go-daemon-command", "get_info");
	}

	async getMonitors(): Promise<Monitor[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_monitors");
	}

	async getDaemonStatus(): Promise<DaemonStatus> {
		return ipcRenderer.invoke("go-daemon-command", "get_daemon_status");
	}

	async getDiagnostics(monitorName?: string): Promise<PlaylistDiagnostics> {
		return ipcRenderer.invoke("go-daemon-command", "get_diagnostics", {
			monitorName,
		});
	}

	async killDaemon(): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "kill_daemon");
	}

	async stopDaemon(): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "stop_daemon");
	}

	// ============================================================================
	// PLAYLIST OPERATIONS
	// ============================================================================

	async getPlaylists(): Promise<StoredPlaylist[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_playlists");
	}

	async getPlaylist(playlistId: number): Promise<StoredPlaylist> {
		return ipcRenderer.invoke("go-daemon-command", "get_playlist", {
			playlistId,
		});
	}

	async savePlaylist(playlist: RendererPlaylist): Promise<StoredPlaylist> {
		// Convert ActiveMonitor to MonitorSelection if needed
		if (playlist.activeMonitor) {
			const activeMonitor = playlist.activeMonitor as unknown as ActiveMonitor;
			if (!("mode" in activeMonitor) || !activeMonitor.mode) {
				playlist.activeMonitor = convertToMonitorSelection(activeMonitor);
			}
		}

		return ipcRenderer.invoke("go-daemon-command", "upsert_playlist", {
			playlist,
		});
	}

	async deletePlaylist(playlistName: string): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "delete_playlist", {
			playlistName,
		});
	}

	async startPlaylist(
		playlistId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "start_playlist", {
			playlistId,
			activeMonitor: monitorSelection,
		});
	}

	async stopPlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "stop_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async pausePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "pause_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async resumePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "resume_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async nextPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "next_playlist_image", {
			activeMonitor: monitorSelection,
		});
	}

	async previousPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "previous_playlist_image", {
			activeMonitor: monitorSelection,
		});
	}

	async getRunningPlaylists(): Promise<Record<string, RunningPlaylistInfo>> {
		return ipcRenderer.invoke("go-daemon-command", "get_running_playlists");
	}

	// ============================================================================
	// IMAGE OPERATIONS
	// ============================================================================

	async getImages(filters?: unknown): Promise<JsonStoreImage[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_images", {
			filters,
		});
	}

	async processImages(imagePaths: string[], fileNames: string[]): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "process_images", {
			imagePaths,
			fileNames,
		});
	}

	async deleteImages(imageIds: number[]): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "delete_images", {
			imageIds,
		});
	}

	async upsertImage(image: ImageInfo): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "upsert_image", {
			image,
		});
	}

	async getImageHistory(): Promise<ImageHistory[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_image_history");
	}

	async processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<Record<string, string>> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		return ipcRenderer.invoke("go-daemon-command", "process_for_monitors", {
			image: { id: imageId },
			activeMonitor: monitorSelection,
		});
	}

	// ============================================================================
	// CONFIGURATION OPERATIONS
	// ============================================================================

	async getConfig(): Promise<UnifiedConfig> {
		return ipcRenderer.invoke("go-daemon-command", "get_config");
	}

	async setConfig(section: string, key: string, value: unknown): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "upsert_config", {
			config: {
				configSection: section,
				configKey: key,
				configValue: value,
			},
		});
	}

	async setBulkConfig(config: Partial<UnifiedConfig>): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "upsert_config", {
			config: {
				frontendConfig: config,
			},
		});
	}

	async setSelectedMonitor(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "set_selected_monitor", {
			activeMonitor: monitorSelection,
		});
	}

	async getSelectedMonitor(): Promise<MonitorSelection> {
		return ipcRenderer.invoke("go-daemon-command", "get_selected_monitor");
	}

	// ============================================================================
	// MISCELLANEOUS OPERATIONS
	// ============================================================================

	async setImage(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection | string,
	): Promise<void> {
		// Handle string input (legacy/mistake - convert to ActiveMonitor)
		let processedMonitor: ActiveMonitor | MonitorSelection;
		if (typeof activeMonitor === "string") {
			// Get monitors to find the one with this name
			const monitors = await this.getMonitors();
			const monitor = monitors.find((m) => m.name === activeMonitor);
			if (!monitor) {
				throw new Error(`Monitor "${activeMonitor}" not found`);
			}
			processedMonitor = {
				monitors: [monitor],
				extendAcrossMonitors: false,
			};
		} else {
			processedMonitor = activeMonitor;
		}

		const monitorSelection =
			"mode" in processedMonitor
				? processedMonitor
				: convertToMonitorSelection(processedMonitor);

		await ipcRenderer.invoke("go-daemon-command", "set_image", {
			image: { id: imageId },
			activeMonitor: monitorSelection,
		});
	}

	async setImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "set_image_across_monitors", {
			image: { id: imageId },
			activeMonitor: monitorSelection,
		});
	}

	async nextImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "next_image_history", {
			activeMonitor: monitorSelection,
		});
	}

	async previousImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "previous_image_history", {
			activeMonitor: monitorSelection,
		});
	}

	async randomImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await ipcRenderer.invoke("go-daemon-command", "random_image", {
			activeMonitor: monitorSelection,
		});
	}

	// ============================================================================
	// EVENT SUBSCRIPTION
	// ============================================================================

	async subscribeToEvents(eventTypes: Array<EventType | "*">): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "subscribe", {
			eventTypes,
		});
	}

	async unsubscribeFromEvents(
		eventTypes: Array<EventType | "*">,
	): Promise<void> {
		await ipcRenderer.invoke("go-daemon-command", "unsubscribe", {
			eventTypes,
		});
	}

	on(event: EventType, callback: (data: unknown) => void): void {
		ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
	}

	off(event: EventType, callback: (data: unknown) => void): void {
		ipcRenderer.off(`go-daemon-event-${event}`, callback);
	}

	// ============================================================================
	// LEGACY COMPATIBILITY
	// ============================================================================

	/** @deprecated Use deleteImages instead */
	async deleteImagesFromGallery(imageIds: number[]): Promise<void> {
		return this.deleteImages(imageIds);
	}

	/** @deprecated Use nextPlaylistImage instead */
	async nextImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void> {
		return this.nextPlaylistImage(activeMonitor);
	}

	/** @deprecated Use previousPlaylistImage instead */
	async previousImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void> {
		return this.previousPlaylistImage(activeMonitor);
	}

	/** @deprecated Use getRunningPlaylists instead */
	async getActivePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<RunningPlaylistInfo | null> {
		const runningPlaylists = await this.getRunningPlaylists();
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		return runningPlaylists[monitorSelection.id] || null;
	}

	/** @deprecated Use getPlaylist instead */
	async getPlaylistImages(playlistId: number): Promise<StoredPlaylist> {
		return this.getPlaylist(playlistId);
	}

	/** @deprecated Use setImageAcrossMonitors with mode: "clone" */
	async duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		// Force clone mode
		monitorSelection.mode = "clone";

		return this.setImage(imageId, monitorSelection);
	}
}

// Export singleton instance
export const goDaemonRendererClient = new GoDaemonRendererClientImpl();
