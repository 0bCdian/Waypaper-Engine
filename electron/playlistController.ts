import { EventEmitter } from "events";
import { type ActiveMonitor } from "../shared/types/monitor";
import { logger } from "../globals/setup";
export class PlaylistController extends EventEmitter {
    createTray: (() => Promise<void>) | undefined;
    constructor(trayReference?: () => Promise<void>) {
        super();
        this.createTray = trayReference;
    }

    async #getGoDaemonClient() {
        const { goDaemonClient } = await import("./goDaemonClient");
        return goDaemonClient;
    }

    async startPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.startPlaylist(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to start playlist:", error);
        }
    }

    async pausePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.pausePlaylist(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to pause playlist:", error);
        }
    }

    async resumePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.resumePlaylist(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to resume playlist:", error);
        }
    }

    async stopPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.stopPlaylist(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist:", error);
        }
    }

    async stopPlaylistByName(playlistName: string) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.stopPlaylistByName(playlistName);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist by name:", error);
        }
    }

    async getInfo() {
        try {
            const client = await this.#getGoDaemonClient();
            return await client.getInfo();
        } catch (error) {
            logger.error("Failed to get info:", error);
            return null;
        }
    }

    async stopPlaylistByMonitorName(monitors: string[]) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.stopPlaylistByMonitorName(monitors);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist by monitor name:", error);
        }
    }

    async stopPlaylistOnRemovedMonitors() {
        try {
            const client = await this.#getGoDaemonClient();
            await client.stopPlaylistOnRemovedMonitors();
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to stop playlist on removed monitors:", error);
        }
    }

    async nextImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.nextImage(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to get next image:", error);
        }
    }

    async previousImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        try {
            const client = await this.#getGoDaemonClient();
            await client.previousImage(playlist.name, playlist.activeMonitor);
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to get previous image:", error);
        }
    }

    async randomImage() {
        try {
            const client = await this.#getGoDaemonClient();
            await client.randomImage();
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to set random image:", error);
        }
    }

    async killDaemon() {
        try {
            const client = await this.#getGoDaemonClient();
            await client.killDaemon();
        } catch (error) {
            logger.error("Failed to kill daemon:", error);
        }
    }

    async updateConfig() {
        try {
            const client = await this.#getGoDaemonClient();
            await client.updateConfig();
            if (this.createTray !== undefined) void this.createTray();
        } catch (error) {
            logger.error("Failed to update config:", error);
        }
    }
}
