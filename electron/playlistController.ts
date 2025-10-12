import { EventEmitter } from "events";
import { type ActiveMonitor } from "../shared/types/monitor";
import { logger } from "../globals/setup";
import { goDaemonClient } from "./goDaemonClient";

export class PlaylistController extends EventEmitter {
    createTray: (() => Promise<void>) | undefined;
    constructor(trayReference?: () => Promise<void>) {
        super();
        this.createTray = trayReference;
    }

    async startPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.startPlaylist(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to start playlist:", error);
        }
    }

    async pausePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.pausePlaylist(playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to pause playlist:", error);
        }
    }

    async resumePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.resumePlaylist(playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to resume playlist:", error);
        }
    }

    async stopPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.stopPlaylist(playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist:", error);
        }
    }

    async stopPlaylistByName(playlistName: string) {
        try {
            await goDaemonClient.stopPlaylistByName(playlistName);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist by name:", error);
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

    async stopPlaylistByMonitorName(monitors: string[]) {
        try {
            await goDaemonClient.stopPlaylistByMonitorName(monitors);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist by monitor name:", error);
        }
    }

    async stopPlaylistOnRemovedMonitors() {
        try {
            await goDaemonClient.stopPlaylistOnRemovedMonitors();
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist on removed monitors:", error);
        }
    }

    async nextImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.nextImage(playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to get next image:", error);
        }
    }

    async previousImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            await goDaemonClient.previousImage(playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to get previous image:", error);
        }
    }

    async randomImage(activeMonitor: ActiveMonitor) {
        try {
            await goDaemonClient.randomImage(activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to set random image:", error);
        }
    }

    async killDaemon() {
        try {
            await goDaemonClient.killDaemon();
        } catch (error) {
            logger.error("Failed to kill daemon:", error);
        }
    }

    async updateConfig() {
        try {
            await goDaemonClient.updateConfig();
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to update config:", error);
        }
    }
}
