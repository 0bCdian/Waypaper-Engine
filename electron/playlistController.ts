import { EventEmitter } from 'events';
import { type Socket, createConnection } from 'net';
import { WAYPAPER_ENGINE_SOCKET_PATH } from './globals/appPaths';
import { ACTIONS, type message } from './types/types';
import { type ActiveMonitor } from '../shared/types/monitor';
import { createTray } from './main';
import { initWaypaperDaemon } from './startDaemons';
export class PlaylistController extends EventEmitter {
    connection: Socket;
    constructor() {
        super();
        this.connection = createConnection(WAYPAPER_ENGINE_SOCKET_PATH);
        this.connection.on('data', data => {
            try {
                const parsedDaemonMessage: message = JSON.parse(
                    data.toString()
                );
                void this.processSocketMessage(parsedDaemonMessage);
                console.log('Data from daemon:', parsedDaemonMessage);
            } catch (e) {
                console.error(e);
            }
        });
    }

    async connectToDaemon() {
        try {
            await initWaypaperDaemon();
            await createTray();
            const daemonSocketConnection = createConnection(
                WAYPAPER_ENGINE_SOCKET_PATH
            );
            daemonSocketConnection.on('data', data => {
                try {
                    const parsedDaemonMessage: message = JSON.parse(
                        data.toString()
                    );
                    void this.processSocketMessage(parsedDaemonMessage);
                    console.log('Data from daemon:', parsedDaemonMessage);
                } catch (e) {
                    console.error(e);
                }
            });
            this.connection = daemonSocketConnection;
        } catch (e) {
            console.error(e);
            console.error(
                'Something went wrong trying to reconnect daemon in playlistController'
            );
            process.exit(1);
        }
    }

    async #sendData(data: message) {
        try {
            this.connection.write(JSON.stringify(data), () => {
                console.log('data sent succesfully', data);
            });
        } catch (error) {
            await initWaypaperDaemon();
            await this.connectToDaemon();
        }
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
            WAYPAPER_ENGINE_SOCKET_PATH
        );
        daemonSocketConnection.write(
            JSON.stringify({ action: ACTIONS.STOP_DAEMON }),
            () => {
                daemonSocketConnection.destroy();
            }
        );

        this.connection.destroy();
    }

    updateConfig() {
        void this.#sendData({
            action: ACTIONS.UPDATE_CONFIG
        });
    }

    async processSocketMessage(message: message) {
        switch (message.action) {
            case ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS:
                console.log(message);
                break;
            case ACTIONS.UPDATE_CONFIG:
                console.log(message);
                break;
            case ACTIONS.RANDOM_IMAGE:
                console.log(message);
                void createTray();
                break;
            case ACTIONS.GET_INFO:
                console.log(message);
                break;
            case ACTIONS.STOP_PLAYLIST_BY_MONITOR_NAME:
                console.log(message);
                break;
            case ACTIONS.START_PLAYLIST:
                // TODO
                break;
            case ACTIONS.STOP_DAEMON:
                void this.connectToDaemon();
                break;
            case ACTIONS.PAUSE_PLAYLIST:
                // TODO
                break;
            case ACTIONS.RESUME_PLAYLIST:
                // TODO
                break;
            case ACTIONS.STOP_PLAYLIST:
                void createTray();
                break;
            case ACTIONS.STOP_PLAYLIST_BY_NAME:
                // TODO
                void createTray();
                break;
            case ACTIONS.NEXT_IMAGE:
                // TODO
                break;
            case ACTIONS.PREVIOUS_IMAGE:
                // TODO
                break;
            case ACTIONS.SET_IMAGE:
                void createTray();
                break;
            default:
                break;
        }
    }
}
