import { EventEmitter } from "events";
import { logger } from "../globals/setup";
import { goDaemonClient } from "./goDaemonClient";
import type { MonitorMode } from "./daemon-go-types";

export class PlaylistController extends EventEmitter {
	createTray: (() => Promise<void>) | undefined;
	constructor(trayReference?: () => Promise<void>) {
		super();
		this.createTray = trayReference;
	}

	async startPlaylist(playlistId: number, monitor: string = "*", mode: MonitorMode = "individual") {
		try {
			await goDaemonClient.startPlaylist(playlistId, monitor, mode);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to start playlist:", error);
		}
	}

	async pausePlaylist(playlistId: number) {
		try {
			await goDaemonClient.pausePlaylist(playlistId);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to pause playlist:", error);
		}
	}

	async resumePlaylist(playlistId: number) {
		try {
			await goDaemonClient.resumePlaylist(playlistId);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to resume playlist:", error);
		}
	}

	async stopPlaylist(playlistId: number) {
		try {
			await goDaemonClient.stopPlaylist(playlistId);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to stop playlist:", error);
		}
	}

	async nextImage(playlistId: number) {
		try {
			await goDaemonClient.nextPlaylistImage(playlistId);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to get next image:", error);
		}
	}

	async previousImage(playlistId: number) {
		try {
			await goDaemonClient.previousPlaylistImage(playlistId);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to get previous image:", error);
		}
	}

	async randomImage(monitor: string = "*", mode: MonitorMode = "individual") {
		try {
			await goDaemonClient.setRandomWallpaper(monitor, mode);
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to set random image:", error);
		}
	}

	async getInfo() {
		try {
			return await goDaemonClient.getInfo();
		} catch (error) {
			logger.error("Failed to get info:", error);
			return null;
		}
	}

	async stopAllPlaylists() {
		try {
			await goDaemonClient.stopAllPlaylists();
			if (this.createTray !== undefined) void this.createTray();
		} catch (error) {
			logger.error("Failed to stop all playlists:", error);
		}
	}

	async shutdown() {
		try {
			await goDaemonClient.shutdown();
		} catch (error) {
			logger.error("Failed to shutdown daemon:", error);
		}
	}
}
