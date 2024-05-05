import { type Socket, type Server, createServer, createConnection } from 'net';
import { type PlaylistClass, Playlist } from './playlist';
import { notify } from '../utils/notifications';
import { configuration, dbOperations } from '../globals/config';
import {
    setImageAcrossMonitors,
    duplicateImageAcrossMonitors
} from '../utils/imageOperations';
import { getMonitors } from '../utils/monitorUtils';
import { unlinkSync } from 'node:fs';
import { type imageSelectType } from '../database/schema';
import { type message } from '../types/types';
import { ACTIONS } from '../types/types';
import { type ActiveMonitor } from '../shared/types/monitor';
import { type rendererImage } from '../src/types/rendererTypes';
import { initSwwwDaemon } from '../globals/startDaemons';
export class DaemonManager {
    serverInstance: Server;

    readonly #playlistMap: Map<string, PlaylistClass>;
    constructor() {
        this.serverInstance = createServer(
            { keepAlive: true, allowHalfOpen: true },
            socket => {
                socket.on('data', buffer => {
                    buffer
                        .toString()
                        .split('\n')
                        .filter(message => message !== '')
                        .forEach(message => {
                            try {
                                const parsedMessage: message =
                                    JSON.parse(message);
                                void this.processSocketMessage(
                                    parsedMessage,
                                    socket
                                );
                            } catch (error) {
                                console.log(message);
                                console.error(error);
                            }
                        });
                });
                socket.on('error', err => {
                    console.error('Socket error:', err.message);
                });
            }
        );
        this.serverInstance.on('error', err => {
            if (err.message.includes('EADDRINUSE')) {
                unlinkSync(
                    configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
                );
                this.serverInstance.listen(
                    configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
                );
            } else {
                console.error(err);
                throw err;
            }
        });
        this.#playlistMap = new Map<string, PlaylistClass>();
        const activePlaylists = dbOperations.getActivePlaylists();
        activePlaylists.forEach(playlist => {
            const playlistInstance = new Playlist({
                playlistName: playlist.Playlists.name,
                activeMonitor: playlist.activePlaylists.monitor,
                wasActive: true
            });
            playlistInstance.start();
            this.#playlistMap.set(
                playlist.activePlaylists.monitor.name,
                playlistInstance
            );
            this.setListeners(playlistInstance);
        });
        this.serverInstance.listen(
            configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
        );
    }

    async processSocketMessage(message: message, socket: Socket) {
        try {
            if (message.action === ACTIONS.STOP_DAEMON) {
                socket.write(JSON.stringify({ action: ACTIONS.STOP_DAEMON }));
                socket.end();
                this.serverInstance.close();
                process.exit(0);
            }
            // options that dont need parameters
            switch (message.action) {
                case ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS:
                    await stopPlaylistOnRemovedDisplays({
                        playlistMap: this.#playlistMap
                    });
                    socket.end();
                    break;

                case ACTIONS.UPDATE_CONFIG:
                    configuration.app.update();
                    configuration.swww.update();
                    socket.end();
                    break;

                case ACTIONS.RANDOM_IMAGE:
                    await this.setRandomImage(socket);
                    break;
                case ACTIONS.PAUSE_PLAYLIST_ALL:
                    this.#playlistMap.forEach(activePlaylist => {
                        activePlaylist.pause();
                    });
                    socket.end();
                    break;
                case ACTIONS.RESUME_PLAYLIST_ALL:
                    this.#playlistMap.forEach(activePlaylist => {
                        activePlaylist.resume();
                    });
                    socket.end();
                    break;
                case ACTIONS.STOP_PLAYLIST_ALL:
                    {
                        const stoppedPlaylists: string[] = [];
                        this.#playlistMap.forEach(playlist => {
                            stoppedPlaylists.push(playlist.name);
                            this.#playlistMap.delete(
                                playlist.activeMonitor.name
                            );
                            playlist.stop();
                        });
                        const message = `Stopped all following playlists:"${JSON.stringify(stoppedPlaylists)}"`;
                        notify(message);
                        socket.end();
                    }
                    break;
                case ACTIONS.NEXT_IMAGE_ALL:
                    this.#playlistMap.forEach(activePlaylist => {
                        void activePlaylist.nextImage();
                    });
                    socket.end();
                    break;
                case ACTIONS.GET_INFO:
                    {
                        const monitors = await getMonitors();
                        socket.write(JSON.stringify(monitors));
                        socket.end();
                    }
                    break;
                case ACTIONS.PREVIOUS_IMAGE_ALL:
                    this.#playlistMap.forEach(activePlaylist => {
                        void activePlaylist.previousImage();
                    });
                    socket.end();
                    break;

                case ACTIONS.GET_INFO_ACTIVE_PLAYLIST:
                    {
                        type Diagnostics = ReturnType<
                            PlaylistClass['getPlaylistDiagnostics']
                        >;
                        const infoArray: Diagnostics[] = [];
                        this.#playlistMap.forEach(playlist => {
                            infoArray.push(playlist.getPlaylistDiagnostics());
                        });
                        const results = await Promise.allSettled(infoArray);
                        const resultsArray = results.map(result =>
                            result.status === 'fulfilled' ? result.value : null
                        );
                        const extractedValues = resultsArray.filter(
                            result => result !== null
                        );
                        socket.write(JSON.stringify(extractedValues));
                        socket.end();
                    }
                    break;
                case ACTIONS.GET_INFO_PLAYLIST:
                    {
                        const playlists = dbOperations.getPlaylists();
                        const completePlaylists = playlists.map(playlist => {
                            const images = dbOperations.getPlaylistImages(
                                playlist.id,
                                playlist.order
                            );
                            return {
                                playlist,
                                images
                            };
                        });
                        socket.write(JSON.stringify(completePlaylists));
                        socket.end();
                    }
                    break;

                case ACTIONS.GET_IMAGE_HISTORY:
                    {
                        const imageHistory = dbOperations.getImageHistory();
                        if (imageHistory.length < 1) return;
                        socket.write(JSON.stringify(imageHistory));
                        socket.end();
                    }
                    break;
                default:
                    break;
            }
            switch (message.action) {
                case ACTIONS.START_PLAYLIST:
                    {
                        const runningPlaylist = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );
                        if (
                            runningPlaylist !== undefined &&
                            runningPlaylist.name === message.playlist.name
                        ) {
                            runningPlaylist.updatePlaylist();
                            notify(`Updating ${message.playlist.name}`);
                            const response: message = {
                                action: ACTIONS.START_PLAYLIST,
                                playlist: message.playlist
                            };
                            socket.write(JSON.stringify(response));
                            socket.end();
                            return;
                        }
                        findAndStopCollidingPlaylists({
                            playlistMap: this.#playlistMap,
                            newPlaylist: message.playlist
                        });
                        const newPlaylist = new Playlist({
                            playlistName: message.playlist.name,
                            activeMonitor: message.playlist.activeMonitor,
                            wasActive: false
                        });
                        this.setListeners(newPlaylist);
                        newPlaylist.start();
                        this.#playlistMap.set(
                            message.playlist.activeMonitor.name,
                            newPlaylist
                        );
                        notify(
                            `Starting ${message.playlist.name} on ${message.playlist.activeMonitor.name}`
                        );
                        socket.write(
                            JSON.stringify({
                                action: ACTIONS.START_PLAYLIST,
                                playlist: message.playlist
                            })
                        );
                        socket.end();
                    }
                    break;

                case ACTIONS.PAUSE_PLAYLIST:
                    {
                        if (message.playlist.activeMonitor === undefined) {
                            if (message.playlist.name === undefined) {
                                socket.end();
                                return;
                            }
                            this.#playlistMap.forEach(playlistActive => {
                                if (
                                    playlistActive.name ===
                                    message.playlist.name
                                ) {
                                    playlistActive.pause();
                                }
                            });
                            socket.end();
                            return;
                        }
                        const playlistInstance = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );
                        playlistInstance?.pause();
                        socket.end();
                    }
                    break;

                case ACTIONS.RESUME_PLAYLIST:
                    {
                        if (message.playlist.activeMonitor === undefined) {
                            if (message.playlist.name === undefined) {
                                socket.end();
                                return;
                            }
                            this.#playlistMap.forEach(playlistActive => {
                                if (
                                    playlistActive.name ===
                                    message.playlist.name
                                ) {
                                    playlistActive.resume();
                                }
                            });
                            socket.end();
                            return;
                        }
                        const playlistInstance = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );
                        playlistInstance?.resume();
                        socket.end();
                    }
                    break;

                case ACTIONS.STOP_PLAYLIST:
                    {
                        if (message.playlist.activeMonitor === undefined) {
                            if (message.playlist.name === undefined) {
                                socket.end();
                                return;
                            }
                            this.#playlistMap.forEach(playlistActive => {
                                if (
                                    playlistActive.name ===
                                    message.playlist.name
                                ) {
                                    playlistActive.stop();
                                }
                            });
                            socket.end();
                            return;
                        }
                        const playlistInstance = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );

                        if (playlistInstance === undefined) {
                            socket.end();
                            return;
                        }
                        this.#playlistMap.delete(
                            playlistInstance.activeMonitor.name
                        );
                        playlistInstance.stop();
                        socket.end();
                    }
                    break;

                case ACTIONS.STOP_PLAYLIST_BY_NAME:
                    stopPlaylistByName({
                        playlistMap: this.#playlistMap,
                        playlistName: message.playlist.name
                    });
                    socket.end();
                    break;

                case ACTIONS.STOP_PLAYLIST_BY_MONITOR_NAME:
                    stopPlaylistByMonitorName({
                        playlistMap: this.#playlistMap,
                        monitors: message.monitors
                    });
                    socket.end();
                    break;

                case ACTIONS.NEXT_IMAGE:
                    {
                        if (message.playlist.activeMonitor === undefined) {
                            if (message.playlist.name === undefined) {
                                return;
                            }
                            this.#playlistMap.forEach(playlistActive => {
                                if (
                                    playlistActive.name ===
                                    message.playlist.name
                                ) {
                                    void playlistActive.nextImage();
                                }
                            });
                            return;
                        }
                        const playlistInstance = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );
                        await playlistInstance?.nextImage();
                    }
                    break;

                case ACTIONS.PREVIOUS_IMAGE:
                    {
                        socket.end();
                        const playlistInstance = this.#playlistMap.get(
                            message.playlist.activeMonitor.name
                        );
                        if (playlistInstance === undefined) {
                            if (message.playlist.name === undefined) {
                                return;
                            }
                            this.#playlistMap.forEach(playlistActive => {
                                if (
                                    playlistActive.name ===
                                    message.playlist.name
                                ) {
                                    void playlistActive.previousImage();
                                }
                            });
                            return;
                        }
                        await playlistInstance.previousImage();
                    }
                    break;
                case ACTIONS.SET_IMAGE:
                    {
                        if (
                            message.image === undefined ||
                            message.activeMonitor === undefined
                        )
                            return;
                        const messageToSend = await this.setImage({
                            image: message.image,
                            activeMonitor: message.activeMonitor
                        });
                        this.sendMessageToMainApp(messageToSend);
                        socket.write(JSON.stringify(messageToSend));
                        socket.end();
                    }
                    break;

                default:
                    socket.end();
                    break;
            }
        } catch (error) {
            try {
                console.error(error);
                socket.write(
                    JSON.stringify({ action: ACTIONS.ERROR, error: { error } })
                );
                socket.end();
            } catch (error) {
                console.error(error);
            }
        }
        socket.end();
    }

    setListeners(newPlaylist: Playlist) {
        newPlaylist.on(ACTIONS.ERROR, (activeMonitorName: string) => {
            const playlistToDelete = this.#playlistMap.get(activeMonitorName);
            if (playlistToDelete === undefined) return;
            playlistToDelete.stop();
            this.#playlistMap.delete(activeMonitorName);
        });
        newPlaylist.on(ACTIONS.SET_IMAGE, (receivedMessage: message) => {
            this.sendMessageToMainApp(receivedMessage);
        });
        newPlaylist.on(ACTIONS.PAUSE_PLAYLIST, (receivedMessage: message) => {
            // typescript shenannigans
            if (receivedMessage.action === ACTIONS.PAUSE_PLAYLIST) {
                notify(`Paused ${receivedMessage.playlist.name}`);
                this.sendMessageToMainApp(receivedMessage);
            }
        });
        newPlaylist.on(ACTIONS.RESUME_PLAYLIST, (receivedMessage: message) => {
            if (receivedMessage.action === ACTIONS.RESUME_PLAYLIST) {
                notify(`Resumed ${receivedMessage.playlist.name}`);
                this.sendMessageToMainApp(receivedMessage);
            }
        });
        newPlaylist.on(ACTIONS.STOP_PLAYLIST, (receivedMessage: message) => {
            this.sendMessageToMainApp(receivedMessage);
        });
        newPlaylist.on(ACTIONS.START_PLAYLIST, (receivedMessage: message) => {
            this.sendMessageToMainApp(receivedMessage);
        });
    }

    cleanUp() {
        this.#playlistMap.clear();
        this.serverInstance.close();
    }

    sendMessageToMainApp(message: message) {
        const connection = createConnection(
            configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH
        );

        connection.on('connect', () => {
            try {
                const messageString = JSON.stringify(message);

                connection.write(messageString + '\n', error => {
                    if (error !== undefined) {
                        return;
                    }
                    connection.end();
                });
            } catch (error) {
                console.error('Could not send message to main', error);
            }
        });

        connection.on('error', error => {
            console.error('Socket connection error:', error);
        });
    }

    async setImage({
        image,
        activeMonitor
    }: {
        image: rendererImage | imageSelectType;
        activeMonitor: ActiveMonitor;
    }) {
        let retries = 0;
        let success = false;
        while (retries < 3) {
            try {
                if (activeMonitor.extendAcrossMonitors) {
                    await setImageAcrossMonitors(
                        image,
                        activeMonitor.monitors,
                        true
                    );
                } else {
                    await duplicateImageAcrossMonitors(
                        image,
                        activeMonitor.monitors,
                        true
                    );
                }
                success = true;
                break;
            } catch (error) {
                initSwwwDaemon();
                retries++;
            }
        }
        if (success) {
            dbOperations.addImageToHistory({
                image,
                activeMonitor
            });
            const message: message = {
                action: ACTIONS.SET_IMAGE,
                image
            };
            return message;
        } else {
            throw new Error('Could not set image,check the logs');
        }
    }

    async setRandomImage(socket: Socket) {
        const monitors = await getMonitors();
        const monitorImages = monitors
            .map(monitor => monitor.currentImage.split('/').at(-1))
            .filter(
                (imageName): imageName is string => imageName !== undefined
            );
        const randomImages = dbOperations.getRandomImage({
            limit: monitors.length,
            alreadySetImages: monitorImages
        });
        if (randomImages === undefined) {
            socket.write(
                JSON.stringify({
                    action: ACTIONS.ERROR,
                    error: { error: 'No images in database' }
                })
            );
            socket.end();
            notify('No images found on database');
            return;
        }
        const imagesSet: Array<{
            image: imageSelectType;
            activeMonitor: ActiveMonitor;
        }> = [];
        switch (configuration.app.config.randomImageMonitor) {
            case 'clone': {
                imagesSet.push({
                    image: randomImages[0],
                    activeMonitor: {
                        name: 'random',
                        monitors,
                        extendAcrossMonitors: false
                    }
                });
                await duplicateImageAcrossMonitors(
                    randomImages[0],
                    monitors,
                    true
                );
                break;
            }
            case 'individual': {
                monitors.forEach((monitor, index) => {
                    // we pass a length 1 array so we set one image per monitor
                    //        const selectedImage =
                    const selectedImage = randomImages[index];
                    imagesSet.push({
                        image: selectedImage,
                        activeMonitor: {
                            name: 'random',
                            monitors: [monitor],
                            extendAcrossMonitors: false
                        }
                    });
                    void duplicateImageAcrossMonitors(
                        selectedImage,
                        [monitor],
                        true
                    );
                });
                break;
            }
            case 'extend': {
                await setImageAcrossMonitors(randomImages[0], monitors, true);
                imagesSet.push({
                    image: randomImages[0],
                    activeMonitor: {
                        name: 'random',
                        monitors,
                        extendAcrossMonitors: true
                    }
                });
                break;
            }
            default:
                socket.write(
                    JSON.stringify({
                        action: ACTIONS.ERROR,
                        error: { error: 'Wrong app configuration detected' }
                    })
                );
                socket.end();
        }

        if (imagesSet.length > 0) {
            imagesSet.forEach(image => {
                dbOperations.addImageToHistory(image);
            });
            socket.write(JSON.stringify({ action: ACTIONS.SET_IMAGE }));
            this.sendMessageToMainApp({ action: ACTIONS.SET_IMAGE });
            socket.end();
        }
    }
}

function findAndStopCollidingPlaylists({
    playlistMap,
    newPlaylist
}: {
    playlistMap: Map<string, PlaylistClass>;
    newPlaylist: { name: string; activeMonitor: ActiveMonitor };
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
