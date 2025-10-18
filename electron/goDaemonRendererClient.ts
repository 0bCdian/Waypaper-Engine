import { ipcRenderer } from "electron";
import type {
	JsonStoreImage,
	DaemonPlaylist,
	DaemonMonitor,
	DaemonSwwwConfig,
} from "../shared/types/daemon";
import type { ActiveMonitor } from "../shared/types/monitor";

export interface GoDaemonRendererClient {
	// Playlist operations
	startPlaylist(
		playlistId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean>;
	stopPlaylist(activeMonitor: ActiveMonitor): Promise<boolean>;
	pausePlaylist(activeMonitor: ActiveMonitor): Promise<boolean>;
	resumePlaylist(activeMonitor: ActiveMonitor): Promise<boolean>;
	savePlaylist(playlist: unknown): Promise<boolean>;
	getRunningPlaylists(): Promise<unknown>;
	deletePlaylist(playlistName: string): Promise<boolean>;
	getActivePlaylist(activeMonitor: ActiveMonitor): Promise<unknown>;
	getPlaylistImages(playlistId: number): Promise<unknown>;

	// Image navigation
	nextImage(activeMonitor: ActiveMonitor): Promise<boolean>;
	previousImage(activeMonitor: ActiveMonitor): Promise<boolean>;
	randomImage(activeMonitor: ActiveMonitor): Promise<boolean>;
	setImage(imageId: number, monitorName: string): Promise<boolean>;

	// Multi-monitor operations
	setImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean>;
	duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean>;
	processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean>;

	// Unified configuration
	getConfig(): Promise<unknown>;
	setConfig(section: string, key: string, value: unknown): Promise<boolean>;

	// Configuration
	getSwwwConfig(): Promise<DaemonSwwwConfig>;

	// Monitor operations
	getMonitors(): Promise<unknown>;
	setSelectedMonitor(activeMonitor: ActiveMonitor): Promise<boolean>;
	getSelectedMonitor(): Promise<unknown>;

	// System
	ping(): Promise<boolean>;
	getDaemonStatus(): Promise<unknown>;
	stopDaemon(): Promise<boolean>;
	killDaemon(): Promise<boolean>;

	// Image processing
	processImages(imagePaths: string[], fileNames: string[]): Promise<boolean>;

	// Event listeners
	on(event: string, callback: (data: unknown) => void): void;
	off(event: string, callback: (data: unknown) => void): void;
}

class GoDaemonRendererClientImpl implements GoDaemonRendererClient {
	// Playlist operations
	startPlaylist = async (
		playlistId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> => {
		return ipcRenderer.invoke("go-daemon-command", "start_playlist", {
			playlistId,
			activeMonitor,
		});
	};

	stopPlaylist = async (activeMonitor: ActiveMonitor): Promise<boolean> => {
		return ipcRenderer.invoke("go-daemon-command", "stop_playlist", {
			activeMonitor,
		});
	};

	pausePlaylist = async (activeMonitor: ActiveMonitor): Promise<boolean> => {
		return ipcRenderer.invoke("go-daemon-command", "pause_playlist", {
			activeMonitor,
		});
	};

	resumePlaylist = async (activeMonitor: ActiveMonitor): Promise<boolean> => {
		return ipcRenderer.invoke("go-daemon-command", "resume_playlist", {
			activeMonitor,
		});
	};

	// Image navigation
	async nextImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "next_image", {
			activeMonitor,
		});
	}

	async previousImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "previous_image", {
			activeMonitor,
		});
	}

	async randomImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "random_image", {
			activeMonitor,
		});
	}

	async setImage(imageId: number, monitorName: string): Promise<boolean> {
		const payload = {
			image: { id: imageId },
			activeMonitor: { name: monitorName },
		};
		console.log("🔵 RendererClient: setImage called with imageId:", imageId, "monitorName:", monitorName);
		console.log("🔵 RendererClient: setImage payload:", payload);
		return ipcRenderer.invoke("go-daemon-command", "set_image", payload);
	}

	// Data queries
	async getImages(filters?: unknown): Promise<JsonStoreImage[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_images", {
			filters,
		}) as Promise<JsonStoreImage[]>;
	}

	async getPlaylists(): Promise<DaemonPlaylist[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_playlists") as Promise<
			DaemonPlaylist[]
		>;
	}

	async getInfo(): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_info");
	}

	async getImageHistory(): Promise<unknown[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_image_history");
	}

	async deleteImagesFromGallery(imageIds: number[]): Promise<boolean> {
		return ipcRenderer.invoke(
			"go-daemon-command",
			"delete_image_from_gallery",
			{ imageIds },
		);
	}

	async getDiagnostics(monitorName?: string): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_diagnostics", {
			monitorName,
		});
	}

	// Multi-monitor operations
	async setImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		return ipcRenderer.invoke(
			"go-daemon-command",
			"set_image_across_monitors",
			{
				image: { id: imageId },
				activeMonitor,
			},
		);
	}

	async duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		return ipcRenderer.invoke(
			"go-daemon-command",
			"duplicate_image_across_monitors",
			{
				image: { id: imageId },
				activeMonitor,
			},
		);
	}

	async processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "process_for_monitors", {
			image: { id: imageId },
			activeMonitor,
		});
	}

	// Playlist operations
	async savePlaylist(playlist: unknown): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "save_playlist", {
			playlist,
		});
	}

	async getRunningPlaylists(): Promise<unknown> {
		return ipcRenderer.invoke(
			"go-daemon-command",
			"get_running_playlists",
		) as Promise<unknown>;
	}

	async deletePlaylist(playlistName: string): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "delete_playlist", {
			playlistName,
		});
	}

	async getActivePlaylist(activeMonitor: ActiveMonitor): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_active_playlist", {
			activeMonitor,
		});
	}

	async getPlaylistImages(playlistId: number): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_playlist_images", {
			playlistId,
		});
	}

	// Unified configuration methods
	getConfig = async (): Promise<unknown> => {
		return ipcRenderer.invoke("go-daemon-command", "get_config");
	};

	setConfig = async (
		section: string,
		key: string,
		value: unknown,
	): Promise<boolean> => {
		return ipcRenderer.invoke("go-daemon-command", "set_config", {
			config: {
				configSection: section,
				configKey: key,
				configValue: value,
			},
		});
	};

	// Monitor operations
	async getMonitors(): Promise<DaemonMonitor[]> {
		return ipcRenderer.invoke("go-daemon-command", "get_monitors") as Promise<
			DaemonMonitor[]
		>;
	}

	async setSelectedMonitor(activeMonitor: ActiveMonitor): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "set_selected_monitor", {
			activeMonitor,
		});
	}

	async getSelectedMonitor(): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_selected_monitor");
	}

	// Configuration
	async getSwwwConfig(): Promise<DaemonSwwwConfig> {
		return ipcRenderer.invoke("go-daemon-command", "get_swww_config");
	}

	// System
	async ping(): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "ping");
	}

	async getDaemonStatus(): Promise<unknown> {
		return ipcRenderer.invoke("go-daemon-command", "get_daemon_status");
	}

	async stopDaemon(): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "stop_daemon");
	}

	async killDaemon(): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "kill_daemon");
	}

	// Image processing
	async processImages(
		imagePaths: string[],
		fileNames: string[],
	): Promise<boolean> {
		return ipcRenderer.invoke("go-daemon-command", "process_images", {
			imagePaths,
			fileNames,
		});
	}

	// Event listeners
	on(event: string, callback: (data: unknown) => void): void {
		ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
	}

	off(event: string, callback: (data: unknown) => void): void {
		ipcRenderer.off(`go-daemon-event-${event}`, callback);
	}
}

// Export singleton instance
export const goDaemonRendererClient = new GoDaemonRendererClientImpl();
