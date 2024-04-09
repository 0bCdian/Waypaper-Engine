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
                            console.log('incoming request:', parsedMessage);
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
        const activePlaylists = dbOperations.getActivePlaylists();
        activePlaylists.forEach(playlist => {
            const playlistInstance = new Playlist({
                playlistName: playlist.Playlists.name,
                activeMonitor: playlist.activePlaylists.monitor
            });
            playlistInstance.start();
            this.#playlistMap.set(
                playlist.activePlaylists.monitor.name,
                playlistInstance
            );
        });

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
            case ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS:
                void stopPlaylistOnRemovedDisplays({
                    playlistMap: this.#playlistMap
                });
                break;
            case ACTIONS.UPDATE_CONFIG:
                configuration.app.update();
                configuration.swww.update();
                break;
            case ACTIONS.RANDOM_IMAGE:
                void this.setRandomImage();
                break;
            case ACTIONS.GET_INFO:
                break;
        }
        if (message.monitors !== undefined) {
            switch (message.action) {
                case ACTIONS.STOP_PLAYLIST_BY_MONITOR_NAME:
                    stopPlaylistByMonitorName({
                        playlistMap: this.#playlistMap,
                        monitors: message.monitors
                    });
                    break;
            }
            return;
        }
        if (message.playlist === undefined) return;
        switch (message.action) {
            case ACTIONS.START_PLAYLIST:
                {
                    console.log(this.#playlistMap.values(), 'Case Start');
                    const runningPlaylist = this.#playlistMap.get(
                        message.playlist.activeMonitor.name
                    );
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
                        activeMonitor: message.playlist.activeMonitor
                    });
                    newPlaylist.start();
                    this.#playlistMap.set(
                        message.playlist.activeMonitor.name,
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
                        `Starting ${message.playlist.name} on ${message.playlist.activeMonitor.name}`
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
                        message.playlist.activeMonitor.name
                    );
                    if (playlistInstance === undefined) return;
                    this.#playlistMap.delete(
                        playlistInstance.activeMonitor.name
                    );
                    const stopMessage = playlistInstance.stop();
                    notify(
                        `${message.action} ${message.playlist.name} on ${message.playlist.activeMonitor.name}`
                    );
                    this.socket?.write(JSON.stringify(stopMessage.message));
                }
                break;
            case ACTIONS.STOP_PLAYLIST_BY_NAME:
                stopPlaylistByName({
                    playlistMap: this.#playlistMap,
                    playlistName: message.playlist.name
                });
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
                await duplicateImageAcrossMonitors(
                    randomImages[0],
                    monitors,
                    true
                );
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
                    void duplicateImageAcrossMonitors(
                        randomImages[index],
                        [monitor],
                        true
                    );
                    // TODO write to socket about this
                });
                break;
            }
            case 'extend': {
                await setImageAcrossMonitors(randomImages[0], monitors, true);
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
    let message = 'Stopped playlists:';
    let shouldSendMessage = false;
    playlistMap.forEach(runningPlaylist => {
        let shouldStopPlaylist = false;
        runningPlaylist.activeMonitor.monitors.forEach(usedMonitor => {
            newPlaylist.activeMonitor.monitors.forEach(newMonitorToUse => {
                if (newMonitorToUse.name === usedMonitor.name) {
                    shouldStopPlaylist = true;
                }
            });
        });
        if (shouldStopPlaylist) {
            shouldSendMessage = true;
            message = message.concat(`\n${runningPlaylist.name}`);
            playlistMap.delete(runningPlaylist.activeMonitor.name);
            runningPlaylist.stop();
        }
    });
    if (shouldSendMessage) {
        notify(message);
    }
}

function stopPlaylistByMonitorName({
    playlistMap,
    monitors
}: {
    playlistMap: Map<string, PlaylistClass>;
    monitors: string[];
}) {
    playlistMap.forEach(runningPlaylist => {
        let shouldStopCurrentPlaylist = false;
        runningPlaylist.activeMonitor.monitors.forEach(
            monitorInRunningPlaylist => {
                if (monitors.includes(monitorInRunningPlaylist.name)) {
                    shouldStopCurrentPlaylist = true;
                }
            }
        );
        if (shouldStopCurrentPlaylist) {
            playlistMap.delete(runningPlaylist.activeMonitor.name);
            runningPlaylist.stop();
        }
    });
}

function stopPlaylistByName({
    playlistMap,
    playlistName
}: {
    playlistMap: Map<string, PlaylistClass>;
    playlistName: string;
}) {
    playlistMap.forEach(runningPlaylist => {
        if (runningPlaylist.name === playlistName) {
            playlistMap.delete(runningPlaylist.activeMonitor.name);
            runningPlaylist.stop();
        }
    });
}

async function stopPlaylistOnRemovedDisplays({
    playlistMap
}: {
    playlistMap: Map<string, PlaylistClass>;
}) {
    const currentMonitors = await getMonitors();
    const monitorNames = currentMonitors.map(
        monitorAvailable => monitorAvailable.name
    );
    playlistMap.forEach(runningPlaylist => {
        let shouldStopCurrentPlaylist = false;
        runningPlaylist.activeMonitor.monitors.forEach(monitorInPlaylist => {
            if (!monitorNames.includes(monitorInPlaylist.name)) {
                shouldStopCurrentPlaylist = true;
            }
        });
        if (shouldStopCurrentPlaylist) {
            playlistMap.delete(runningPlaylist.activeMonitor.name);
            runningPlaylist.stop();
        }
    });
}
