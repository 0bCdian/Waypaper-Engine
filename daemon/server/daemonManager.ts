import {
    WAYPAPER_ENGINE_SOCKET_PATH,
    appDirectories
} from '../config/appPaths';
import { type Socket, type Server, createServer } from 'net';
import { type message, ACTIONS } from '../types/daemonTypes';
import { type PlaylistClass, Playlist } from '../playlist/playlist';
import { notify, notifyImageSet } from '../utils/notifications';
import { configuration, dbOperations } from '../config/config';
import {
    setImageAcrossMonitors,
    duplicateImageAcrossMonitors
} from '../utils/imageOperations';
import { getMonitors } from '../utils/monitorUtils';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
export class DaemonManager {
    serverInstance: Server;
    socket?: Socket;
    readonly #playlistMap: Map<string, PlaylistClass>;
    constructor() {
        this.serverInstance = createServer(socket => {
            this.socket = socket;
            socket.on('data', buffer => {
                buffer
                    .toString()
                    .split('\n')
                    .forEach(message => {
                        try {
                            const parsedMessage: message = JSON.parse(message);
                            console.log(parsedMessage);
                            void this.processSocketMessage(parsedMessage);
                        } catch (error) {
                            socket.write('Error reading buffer');
                        }
                    });
            });
            socket.on('error', err => {
                console.error('Socket error:', err.message);
            });
        });
        this.#playlistMap = new Map<string, PlaylistClass>();

        this.serverInstance.on('error', err => {
            if (err.message.includes('EADDRINUSE')) {
                unlinkSync(WAYPAPER_ENGINE_SOCKET_PATH);
                this.serverInstance.listen(WAYPAPER_ENGINE_SOCKET_PATH);
            } else {
                console.error(err);
            }
        });
        this.serverInstance.listen(WAYPAPER_ENGINE_SOCKET_PATH);
    }

    async processSocketMessage(message: message) {
        if (message.action === ACTIONS.STOP_DAEMON) {
            const stoppedPlaylists: string[] = [];
            this.#playlistMap.forEach(playlist => {
                stoppedPlaylists.push(playlist.name);
                playlist.stop();
            });
            const message = `Stopped all following playlists:${JSON.stringify(stoppedPlaylists)}`;
            notify(message);
            this.socket?.write(message);
            this.serverInstance.close();
            process.exit(0);
        }
        switch (message.action) {
            case ACTIONS.UPDATE_CONFIG:
                configuration.app.update();
                configuration.swww.update();
                break;
            case ACTIONS.RANDOM_IMAGE:
                // TODO
                break;
            case ACTIONS.GET_INFO:
                break;
        }
        if (message.playlist === undefined) return;
        switch (message.action) {
            case ACTIONS.START_PLAYLIST:
                {
                    const runningPlaylist = findActivePlaylistMatch({
                        playlistMap: this.#playlistMap,
                        newPlaylist: message.playlist
                    });
                    if (runningPlaylist !== undefined) {
                        runningPlaylist.updatePlaylist();
                        notify(`Updating ${message.playlist.name}`);
                        this.socket?.write(
                            JSON.stringify(`Updating ${message.playlist.name}`)
                        );
                        return;
                    }
                    findAndStopCollidingPlaylists({
                        playlistMap: this.#playlistMap,
                        newPlaylist: message.playlist
                    });
                    const newPlaylist = new Playlist({
                        playlistName: message.playlist.name,
                        activeMonitor: message.playlist.monitor
                    });
                    newPlaylist.start();
                    this.#playlistMap.set(
                        message.playlist.monitor.name,
                        newPlaylist
                    );
                    newPlaylist.on('Error', (activeMonitorName: string) => {
                        const playlistToDelete =
                            this.#playlistMap.get(activeMonitorName);
                        if (playlistToDelete === undefined) return;
                        playlistToDelete.stop();
                        this.#playlistMap.delete(activeMonitorName);
                    });
                    notify(
                        `Starting ${message.playlist.name} on ${message.playlist.monitor.name}`
                    );
                    this.socket?.write(
                        JSON.stringify(`Starting ${message.playlist.name}`)
                    );
                }
                break;

            case ACTIONS.PAUSE_PLAYLIST:
                {
                    const playlistInstance = this.#playlistMap.get(
                        message.playlist.name
                    );
                    if (playlistInstance === undefined) return;
                    const pauseMessage = playlistInstance.pause();
                    notify(pauseMessage);
                    this.socket?.write(pauseMessage);
                }
                break;
            case ACTIONS.RESUME_PLAYLIST:
                {
                    const playlistInstance = this.#playlistMap.get(
                        message.playlist.name
                    );
                    if (playlistInstance === undefined) return;
                    const resumeMessage = playlistInstance.resume();
                    notify(resumeMessage);
                    this.socket?.write(resumeMessage);
                }
                break;
            case ACTIONS.STOP_PLAYLIST:
                {
                    const playlistInstance = this.#playlistMap.get(
                        message.playlist.monitor.name
                    );
                    if (playlistInstance === undefined) return;
                    const stopMessage = playlistInstance.stop();
                    notify(
                        `${message.action} ${message.playlist.name} on ${message.playlist.monitor.name}`
                    );
                    this.socket?.write(JSON.stringify(stopMessage.message));
                }
                break;
            case ACTIONS.NEXT_IMAGE:
                {
                    const playlistInstance = this.#playlistMap.get(
                        message.playlist.name
                    );
                    if (playlistInstance === undefined) return;
                    const nextImageMessage = await playlistInstance.nextImage();
                    this.socket?.write(nextImageMessage);
                }
                break;
            case ACTIONS.PREVIOUS_IMAGE:
                {
                    const playlistInstance = this.#playlistMap.get(
                        message.playlist.name
                    );
                    if (playlistInstance === undefined) return;
                    const previousImageMessage =
                        await playlistInstance.previousImage();
                    this.socket?.write(previousImageMessage);
                }
                break;
        }
    }

    cleanUp() {
        this.#playlistMap.clear();
    }

    async setRandomImage() {
        const monitors = await getMonitors();
        const randomImages = dbOperations.getRandomImage(monitors.length);
        if (randomImages === undefined) {
            this.socket?.write('No images found on database\n');
            notify('No images found on database');
            return;
        }
        switch (configuration.app.settings.randomImageMonitor) {
            case 'clone': {
                await duplicateImageAcrossMonitors(randomImages[0], monitors);
                notifyImageSet(
                    randomImages[0].name,
                    join(appDirectories.imagesDir, randomImages[0].name)
                );
                // TODO write to socket about this
                break;
            }
            case 'individual': {
                monitors.forEach((monitor, index) => {
                    // we pass a length 1 array so we set one image per monitor
                    void duplicateImageAcrossMonitors(randomImages[index], [
                        monitor
                    ]);
                    // TODO write to socket about this
                });
                break;
            }
            case 'extend': {
                await setImageAcrossMonitors(randomImages[0], monitors);
                break;
                // TODO write to socket about this
            }
            default:
                this.socket?.write('Wrong app configuration detected');
            // TODO write to socket about this
        }
    }
}

function findAndStopCollidingPlaylists({
    playlistMap,
    newPlaylist
}: {
    playlistMap: Map<string, PlaylistClass>;
    newPlaylist: NonNullable<message['playlist']>;
}) {
    const playlistMatchByMonitor = playlistMap.get(newPlaylist.monitor.name);
    if (playlistMatchByMonitor === undefined) return;
    playlistMap.delete(playlistMatchByMonitor.activeMonitor.name);
    playlistMatchByMonitor.stop();
}

function findActivePlaylistMatch({
    playlistMap,
    newPlaylist
}: {
    playlistMap: Map<string, PlaylistClass>;
    newPlaylist: NonNullable<message['playlist']>;
}) {
    return playlistMap.get(newPlaylist.monitor.name);
}
