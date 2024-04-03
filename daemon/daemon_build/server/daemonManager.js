"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DaemonManager_playlistMap;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaemonManager = void 0;
const appPaths_1 = require("../config/appPaths");
const net_1 = require("net");
const daemonTypes_1 = require("../types/daemonTypes");
const playlist_1 = require("../playlist/playlist");
const notifications_1 = require("../utils/notifications");
const config_1 = require("../config/config");
const imageOperations_1 = require("../utils/imageOperations");
const monitorUtils_1 = require("../utils/monitorUtils");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
class DaemonManager {
    constructor() {
        _DaemonManager_playlistMap.set(this, void 0);
        this.serverInstance = (0, net_1.createServer)(socket => {
            this.socket = socket;
            socket.on('data', buffer => {
                buffer
                    .toString()
                    .split('\n')
                    .forEach(message => {
                    try {
                        const parsedMessage = JSON.parse(message);
                        console.log(parsedMessage);
                        void this.processSocketMessage(parsedMessage);
                    }
                    catch (error) {
                        socket.write('Error reading buffer');
                    }
                });
            });
            socket.on('error', err => {
                console.error('Socket error:', err.message);
            });
        });
        __classPrivateFieldSet(this, _DaemonManager_playlistMap, new Map(), "f");
        this.serverInstance.on('error', err => {
            if (err.message.includes('EADDRINUSE')) {
                (0, node_fs_1.unlinkSync)(appPaths_1.WAYPAPER_ENGINE_SOCKET_PATH);
                this.serverInstance.listen(appPaths_1.WAYPAPER_ENGINE_SOCKET_PATH);
            }
            else {
                console.error(err);
            }
        });
        this.serverInstance.listen(appPaths_1.WAYPAPER_ENGINE_SOCKET_PATH);
    }
    processSocketMessage(message) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __awaiter(this, void 0, void 0, function* () {
            if (message.action === daemonTypes_1.ACTIONS.STOP_DAEMON) {
                const stoppedPlaylists = [];
                __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").forEach(playlist => {
                    stoppedPlaylists.push(playlist.name);
                    playlist.stop();
                });
                const message = `Stopped all following playlists:${JSON.stringify(stoppedPlaylists)}`;
                (0, notifications_1.notify)(message);
                (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(message);
                this.serverInstance.close();
                process.exit(0);
            }
            switch (message.action) {
                case daemonTypes_1.ACTIONS.UPDATE_CONFIG:
                    config_1.configuration.app.update();
                    config_1.configuration.swww.update();
                    break;
                case daemonTypes_1.ACTIONS.RANDOM_IMAGE:
                    // TODO
                    break;
                case daemonTypes_1.ACTIONS.GET_INFO:
                    break;
            }
            if (message.playlist === undefined)
                return;
            switch (message.action) {
                case daemonTypes_1.ACTIONS.START_PLAYLIST:
                    {
                        const runningPlaylist = findActivePlaylistMatch({
                            playlistMap: __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f"),
                            newPlaylist: message.playlist
                        });
                        if (runningPlaylist !== undefined) {
                            runningPlaylist.updatePlaylist();
                            (0, notifications_1.notify)(`Updating ${message.playlist.name}`);
                            (_b = this.socket) === null || _b === void 0 ? void 0 : _b.write(JSON.stringify(`Updating ${message.playlist.name}`));
                            return;
                        }
                        findAndStopCollidingPlaylists({
                            playlistMap: __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f"),
                            newPlaylist: message.playlist
                        });
                        const newPlaylist = new playlist_1.Playlist({
                            playlistName: message.playlist.name,
                            activeMonitor: message.playlist.monitor
                        });
                        newPlaylist.start();
                        __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").set(message.playlist.monitor.name, newPlaylist);
                        newPlaylist.on('Error', (activeMonitorName) => {
                            const playlistToDelete = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(activeMonitorName);
                            if (playlistToDelete === undefined)
                                return;
                            playlistToDelete.stop();
                            __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").delete(activeMonitorName);
                        });
                        (0, notifications_1.notify)(`Starting ${message.playlist.name} on ${message.playlist.monitor.name}`);
                        (_c = this.socket) === null || _c === void 0 ? void 0 : _c.write(JSON.stringify(`Starting ${message.playlist.name}`));
                    }
                    break;
                case daemonTypes_1.ACTIONS.PAUSE_PLAYLIST:
                    {
                        const playlistInstance = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(message.playlist.name);
                        if (playlistInstance === undefined)
                            return;
                        const pauseMessage = playlistInstance.pause();
                        (0, notifications_1.notify)(pauseMessage);
                        (_d = this.socket) === null || _d === void 0 ? void 0 : _d.write(pauseMessage);
                    }
                    break;
                case daemonTypes_1.ACTIONS.RESUME_PLAYLIST:
                    {
                        const playlistInstance = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(message.playlist.name);
                        if (playlistInstance === undefined)
                            return;
                        const resumeMessage = playlistInstance.resume();
                        (0, notifications_1.notify)(resumeMessage);
                        (_e = this.socket) === null || _e === void 0 ? void 0 : _e.write(resumeMessage);
                    }
                    break;
                case daemonTypes_1.ACTIONS.STOP_PLAYLIST:
                    {
                        const playlistInstance = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(message.playlist.monitor.name);
                        if (playlistInstance === undefined)
                            return;
                        const stopMessage = playlistInstance.stop();
                        (0, notifications_1.notify)(`${message.action} ${message.playlist.name} on ${message.playlist.monitor.name}`);
                        (_f = this.socket) === null || _f === void 0 ? void 0 : _f.write(JSON.stringify(stopMessage.message));
                    }
                    break;
                case daemonTypes_1.ACTIONS.NEXT_IMAGE:
                    {
                        const playlistInstance = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(message.playlist.name);
                        if (playlistInstance === undefined)
                            return;
                        const nextImageMessage = yield playlistInstance.nextImage();
                        (_g = this.socket) === null || _g === void 0 ? void 0 : _g.write(nextImageMessage);
                    }
                    break;
                case daemonTypes_1.ACTIONS.PREVIOUS_IMAGE:
                    {
                        const playlistInstance = __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").get(message.playlist.name);
                        if (playlistInstance === undefined)
                            return;
                        const previousImageMessage = yield playlistInstance.previousImage();
                        (_h = this.socket) === null || _h === void 0 ? void 0 : _h.write(previousImageMessage);
                    }
                    break;
            }
        });
    }
    cleanUp() {
        __classPrivateFieldGet(this, _DaemonManager_playlistMap, "f").clear();
    }
    setRandomImage() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const monitors = yield (0, monitorUtils_1.getMonitors)();
            const randomImages = config_1.dbOperations.getRandomImage(monitors.length);
            if (randomImages === undefined) {
                (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write('No images found on database\n');
                (0, notifications_1.notify)('No images found on database');
                return;
            }
            switch (config_1.configuration.app.settings.randomImageMonitor) {
                case 'clone': {
                    yield (0, imageOperations_1.duplicateImageAcrossMonitors)(randomImages[0], monitors);
                    (0, notifications_1.notifyImageSet)(randomImages[0].name, (0, node_path_1.join)(appPaths_1.appDirectories.imagesDir, randomImages[0].name));
                    // TODO write to socket about this
                    break;
                }
                case 'individual': {
                    monitors.forEach((monitor, index) => {
                        // we pass a length 1 array so we set one image per monitor
                        void (0, imageOperations_1.duplicateImageAcrossMonitors)(randomImages[index], [
                            monitor
                        ]);
                        // TODO write to socket about this
                    });
                    break;
                }
                case 'extend': {
                    yield (0, imageOperations_1.setImageAcrossMonitors)(randomImages[0], monitors);
                    break;
                    // TODO write to socket about this
                }
                default:
                    (_b = this.socket) === null || _b === void 0 ? void 0 : _b.write('Wrong app configuration detected');
                // TODO write to socket about this
            }
        });
    }
}
exports.DaemonManager = DaemonManager;
_DaemonManager_playlistMap = new WeakMap();
function findAndStopCollidingPlaylists({ playlistMap, newPlaylist }) {
    const playlistMatchByMonitor = playlistMap.get(newPlaylist.monitor.name);
    if (playlistMatchByMonitor === undefined)
        return;
    playlistMap.delete(playlistMatchByMonitor.activeMonitor.name);
    playlistMatchByMonitor.stop();
}
function findActivePlaylistMatch({ playlistMap, newPlaylist }) {
    return playlistMap.get(newPlaylist.monitor.name);
}
//# sourceMappingURL=daemonManager.js.map