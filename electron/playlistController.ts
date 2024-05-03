import { EventEmitter } from 'events';
import { createConnection } from 'net';
import { configuration } from '../globals/config';
import { ACTIONS, type message } from '../types/types';
import { type ActiveMonitor } from '../shared/types/monitor';
import { initWaypaperDaemon } from '../globals/startDaemons';
const WAYPAPER_ENGINE_DAEMON_SOCKET_PATH =
    configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH;
export class PlaylistController extends EventEmitter {
    createTray: (() => Promise<void>) | undefined;
    retries: number;
    constructor(trayReference?: () => Promise<void>) {
        super();
        this.createTray = trayReference;
        this.retries = 0;
    }

    async #sendData(data: message) {
        const connection = createConnection(WAYPAPER_ENGINE_DAEMON_SOCKET_PATH);
        connection.on('connect', () => {
            try {
                connection.write(JSON.stringify(data) + '\n', e => {
                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    if (e) {
                        console.error(e);
                        return;
                    }
                    console.log(
                        'data sent succesfully:',
                        `${JSON.stringify(data)}\n`
                    );
                    this.retries = 0;
                    if (this.createTray !== undefined) void this.createTray();
                });
            } catch (error) {
                console.error(error);
            }
        });
        connection.on('data', data => {
            try {
                const parsedDaemonMessage: message = JSON.parse(
                    data.toString()
                );
                console.log('Data from daemon:', parsedDaemonMessage);
                if (this.createTray !== undefined) void this.createTray();
            } catch (e) {
                console.error(e);
            }
        });
        connection.on('error', () => {
            if (this.retries > 3) throw new Error('Could not restart daemon');
            this.retries++;
            void initWaypaperDaemon().then(() => {
                void this.#sendData(data);
            });
        });
    }

    startPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.START_PLAYLIST,
            playlist
        });
    }

    pausePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.PAUSE_PLAYLIST,
            playlist
        });
    }

    resumePlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.RESUME_PLAYLIST,
            playlist
        });
    }

    stopPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.STOP_PLAYLIST,
            playlist
        });
    }

    stopPlaylistByName(playlistName: string) {
        void this.#sendData({
            action: ACTIONS.STOP_PLAYLIST_BY_NAME,
            playlist: {
                name: playlistName
            }
        });
    }

    getInfo() {
        void this.#sendData({
            action: ACTIONS.GET_INFO
        });
    }

    stopPlaylistByMonitorName(monitors: string[]) {
        void this.#sendData({
            action: ACTIONS.STOP_PLAYLIST_BY_MONITOR_NAME,
            monitors
        });
    }

    stopPlaylistOnRemovedMonitors() {
        void this.#sendData({
            action: ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS
        });
    }

    nextImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.NEXT_IMAGE,
            playlist
        });
    }

    previousImage(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        void this.#sendData({
            action: ACTIONS.PREVIOUS_IMAGE,
            playlist
        });
    }

    randomImage() {
        void this.#sendData({
            action: ACTIONS.RANDOM_IMAGE
        });
    }

    killDaemon() {
        const daemonSocketConnection = createConnection(
            WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
        );
        daemonSocketConnection.write(
            JSON.stringify({ action: ACTIONS.STOP_DAEMON }),
            () => {
                daemonSocketConnection.destroy();
            }
        );
    }

    updateConfig() {
        void this.#sendData({
            action: ACTIONS.UPDATE_CONFIG
        });
    }
}
