import { EventEmitter } from 'events';
import { createConnection } from 'net';
import { WAYPAPER_ENGINE_SOCKET_PATH } from './globals/appPaths';
import { ACTIONS, type message } from './types/types';
import { type ActiveMonitor } from '../shared/types/monitor';
export class PlaylistController extends EventEmitter {
    #sendData(data: message) {
        console.log('sending data from PlaylistController', data);
        const connection = createConnection(WAYPAPER_ENGINE_SOCKET_PATH);
        connection.write(JSON.stringify(data).concat('\n'), () => {
            connection.destroy();
        });
        connection.on('data', data => {
            console.log('Data from daemon:', data.toString());
        });
    }

    startPlaylist(playlist: { name: string; activeMonitor: ActiveMonitor }) {
        this.#sendData({
            action: ACTIONS.START_PLAYLIST,
            playlist
        });
    }

    pausePlaylist(playlist: message['playlist']) {
        this.#sendData({
            action: ACTIONS.PAUSE_PLAYLIST,
            playlist
        });
    }

    resumePlaylist(playlist: message['playlist']) {
        this.#sendData({
            action: ACTIONS.RESUME_PLAYLIST,
            playlist
        });
    }

    stopPlaylist(playlist: message['playlist']) {
        this.#sendData({
            action: ACTIONS.STOP_PLAYLIST,
            playlist
        });
    }

    nextImage(playlist: message['playlist']) {
        this.#sendData({
            action: ACTIONS.NEXT_IMAGE,
            playlist
        });
    }

    previousImage(playlist: message['playlist']) {
        this.#sendData({
            action: ACTIONS.PREVIOUS_IMAGE,
            playlist
        });
    }

    randomImage() {
        this.#sendData({
            action: ACTIONS.RANDOM_IMAGE
        });
    }

    killDaemon() {
        this.#sendData({
            action: ACTIONS.STOP_DAEMON
        });
    }

    updateConfig() {
        this.#sendData({
            action: ACTIONS.UPDATE_CONFIG
        });
    }
}
