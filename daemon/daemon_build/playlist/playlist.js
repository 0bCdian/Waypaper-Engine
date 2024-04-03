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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Playlist = void 0;
const daemonTypes_1 = require("../types/daemonTypes");
const config_1 = require("../config/config");
const dbOperations_1 = require("../database/dbOperations");
const notifications_1 = require("../utils/notifications");
const imageOperations_1 = require("../utils/imageOperations");
const node_stream_1 = require("node:stream");
class Playlist extends node_stream_1.EventEmitter {
    constructor({ playlistName, activeMonitor }) {
        super();
        this.dbOperations = new dbOperations_1.DBOperations();
        const currentPlaylist = this.dbOperations.getPlaylistInfo({
            name: playlistName
        });
        if (currentPlaylist === undefined) {
            this.emit('Error', activeMonitor.name);
        }
        this.images = currentPlaylist.images;
        this.name = playlistName;
        this.currentType = currentPlaylist.type;
        this.currentImageIndex = config_1.configuration.app.settings
            .playlistStartOnFirstImage
            ? 0
            : currentPlaylist.currentImageIndex;
        this.interval = currentPlaylist.interval;
        this.showAnimations = config_1.configuration.app.settings.swwwAnimations;
        this.playlistTimer = {
            timeoutID: undefined,
            executionTimeStamp: undefined
        };
        this.eventCheckerTimeout = undefined;
        this.activeMonitor = activeMonitor;
        this.dbOperations.insertIntoActivePlaylists({
            playlistID: currentPlaylist.id,
            monitor: activeMonitor
        });
    }
    setImage(image) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.activeMonitor.extendAcrossMonitors) {
                yield (0, imageOperations_1.setImageAcrossMonitors)(image, this.activeMonitor.monitor);
            }
            else {
                yield (0, imageOperations_1.duplicateImageAcrossMonitors)(image, this.activeMonitor.monitor);
            }
            this.dbOperations.addImageToHistory({
                image,
                activeMonitor: this.activeMonitor
            });
        });
    }
    pause() {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            clearTimeout(this.playlistTimer.timeoutID);
            this.playlistTimer.timeoutID = undefined;
            return `Paused ${this.name}`;
        }
        else {
            return `Cannot pause ${this.name} because it's of type ${this.currentType}`;
        }
    }
    resume() {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            void this.timedPlaylist(true);
            return `Resuming ${this.name}`;
        }
        else {
            return `Cannot resume ${this.name} because it is of type ${this.currentType}`;
        }
    }
    stop() {
        this.dbOperations.removeActivePlaylist({
            playlistName: this.name
        });
        // Make sure we clean the timers to avoid memory leaks
        if (this.eventCheckerTimeout !== undefined) {
            clearInterval(this.eventCheckerTimeout);
        }
        if (this.playlistTimer.timeoutID !== undefined) {
            clearTimeout(this.playlistTimer.timeoutID);
        }
        this.playlistTimer.timeoutID = undefined;
        this.playlistTimer.executionTimeStamp = undefined;
        this.eventCheckerTimeout = undefined;
        return {
            action: daemonTypes_1.ACTIONS.STOP_PLAYLIST,
            message: `Stopped ${this.name}`
        };
    }
    resetInterval() {
        clearTimeout(this.playlistTimer.timeoutID);
        this.playlistTimer.timeoutID = undefined;
        void this.timedPlaylist(true);
    }
    nextImage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
                this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY) {
                (0, notifications_1.notify)('Cannot change image in this type of playlist');
                return 'Cannot change image in this type of playlist';
            }
            this.currentImageIndex++;
            if (this.currentImageIndex === this.images.length) {
                this.currentImageIndex = 0;
            }
            if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
                this.resetInterval();
            }
            yield this.setImage(this.images[this.currentImageIndex]);
            try {
                this.updateInDB();
            }
            catch (error) {
                const errorString = error;
                (0, notifications_1.notify)(`Could not connect to the database\n Error:\n${errorString}`);
                throw error;
            }
            return `Setting:${this.images[this.currentImageIndex].name}`;
        });
    }
    previousImage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
                this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY) {
                (0, notifications_1.notify)('Cannot change image in this type of playlist');
                return 'Cannot change image in this type of playlist';
            }
            this.currentImageIndex--;
            if (this.currentImageIndex < 0) {
                this.currentImageIndex = this.images.length - 1;
            }
            if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
                this.resetInterval();
            }
            yield this.setImage(this.images[this.currentImageIndex]);
            try {
                this.updateInDB();
            }
            catch (error) {
                const errorString = error;
                (0, notifications_1.notify)(`Could not connect to the database\n Error:\n${errorString}`);
                throw error;
            }
            return `Setting:${this.images[this.currentImageIndex].name}`;
        });
    }
    start() {
        try {
            switch (this.currentType) {
                case daemonTypes_1.PLAYLIST_TYPES.TIMER:
                    void this.timedPlaylist();
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.NEVER:
                    void this.neverPlaylist();
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY:
                    void this.timeOfDayPlaylist().then(() => {
                        void this.checkMissedEvents();
                    });
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                    void this.dayOfWeekPlaylist().then(() => {
                        void this.checkMissedEvents();
                    });
                    break;
                default:
                    this.emit('Error', this.activeMonitor.name);
                    break;
            }
        }
        catch (error) {
            const errorString = error;
            (0, notifications_1.notify)(`Could not connect to the database\n Error:\n${errorString}`);
            throw error;
        }
    }
    updatePlaylist() {
        const newPlaylistInfo = this.dbOperations.getActivePlaylistInfo(this.activeMonitor);
        if (newPlaylistInfo === undefined) {
            this.emit('Error', this.activeMonitor.name);
            return;
        }
        this.stop();
        const { name, interval, images, showAnimations, type, currentImageIndex, id } = newPlaylistInfo;
        this.images = images;
        this.name = name;
        this.currentType = type;
        this.currentImageIndex = config_1.configuration.app.settings
            .playlistStartOnFirstImage
            ? 0
            : currentImageIndex;
        this.interval = interval;
        this.showAnimations = showAnimations;
        this.dbOperations.insertIntoActivePlaylists({
            playlistID: id,
            monitor: this.activeMonitor
        });
        this.start();
    }
    updateInDB() {
        try {
            this.dbOperations.updatePlaylistCurrentIndex({
                newIndex: this.currentImageIndex,
                name: this.name
            });
        }
        catch (error) {
            const errorString = error;
            (0, notifications_1.notify)(`Could not connect to the database\n Error:\n${errorString}`);
            throw error;
        }
    }
    timedPlaylist(resume) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.interval !== null) {
                if (!(resume !== null && resume !== void 0 ? resume : false)) {
                    yield this.setImage(this.images[this.currentImageIndex]);
                }
                this.playlistTimer.timeoutID = setInterval(() => {
                    this.currentImageIndex++;
                    if (this.currentImageIndex === this.images.length) {
                        this.currentImageIndex = 0;
                    }
                    void this.setImage(this.images[this.currentImageIndex]);
                    this.updateInDB();
                }, this.interval);
            }
            else {
                console.error('Interval is null');
                (0, notifications_1.notify)('Interval is null, something went wrong setting the playlist');
            }
        });
    }
    neverPlaylist() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setImage(this.images[this.currentImageIndex]);
        });
    }
    timeOfDayPlaylist() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const startingIndex = this.findClosestImageIndex();
                if (startingIndex === undefined) {
                    (0, notifications_1.notify)('Images have no time, something went wrong');
                    this.emit('Error', this.activeMonitor.name);
                    return;
                }
                this.currentImageIndex =
                    startingIndex < 0 ? this.images.length - 1 : startingIndex;
                yield this.setImage(this.images[this.currentImageIndex]);
                this.timeOfDayPlayer();
            }
            catch (error) {
                const errorString = error;
                (0, notifications_1.notify)(`Could not connect to the database\n Error:\n${errorString}`);
                throw error;
            }
        });
    }
    dayOfWeekPlaylist() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
            const millisecondsUntilEndOfDay = endOfDay.getTime() - now.getTime();
            let imageIndexToSet = now.getDay();
            if (imageIndexToSet > this.images.length) {
                imageIndexToSet = this.images.length - 1;
            }
            yield this.setImage(this.images[imageIndexToSet]);
            clearTimeout(this.playlistTimer.timeoutID);
            this.playlistTimer.timeoutID = setTimeout(() => {
                void this.dayOfWeekPlaylist();
            }, millisecondsUntilEndOfDay);
            this.playlistTimer.executionTimeStamp =
                millisecondsUntilEndOfDay + Date.now();
        });
    }
    timeOfDayPlayer() {
        const timeOut = this.calculateMillisecondsUntilNextImage();
        if (timeOut === undefined) {
            (0, notifications_1.notify)('Playlist internal error');
            this.emit('Error', this.activeMonitor.name);
            return;
        }
        clearTimeout(this.playlistTimer.timeoutID);
        this.playlistTimer.timeoutID = setTimeout(() => {
            let newIndex = this.currentImageIndex + 1;
            if (newIndex === this.images.length) {
                newIndex = 0;
            }
            this.currentImageIndex = newIndex;
            void this.setImage(this.images[this.currentImageIndex]);
            this.timeOfDayPlayer();
        }, timeOut);
        this.playlistTimer.executionTimeStamp = timeOut + Date.now();
    }
    calculateMillisecondsUntilNextImage() {
        const nextIndex = this.currentImageIndex + 1 === this.images.length
            ? 0
            : this.currentImageIndex + 1;
        const nextTime = this.images[nextIndex].time;
        if (nextTime === null)
            return undefined;
        const date = new Date();
        const nowInMinutes = date.getHours() * 60 + date.getMinutes();
        let time = nextTime - nowInMinutes;
        if (time < 0) {
            time += 1440;
        }
        time = 60 * time;
        time = time - date.getSeconds();
        time = time * 1000;
        return time;
    }
    findClosestImageIndex() {
        const date = new Date();
        const currentTime = date.getHours() * 60 + date.getMinutes();
        let low = 0;
        let high = this.images.length - 1;
        let closestIndex = -1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midTime = this.images[mid].time;
            if (midTime === null)
                return undefined;
            if (midTime === currentTime) {
                return mid;
            }
            else if (midTime < currentTime) {
                closestIndex = mid;
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        return closestIndex;
    }
    checkMissedEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            clearTimeout(this.eventCheckerTimeout);
            this.eventCheckerTimeout = setInterval(() => {
                const now = Date.now();
                if (this.playlistTimer.executionTimeStamp === undefined ||
                    now < this.playlistTimer.executionTimeStamp ||
                    this.playlistTimer.timeoutID === undefined ||
                    this.currentType === undefined) {
                    return;
                }
                clearTimeout(this.playlistTimer.timeoutID);
                switch (this.currentType) {
                    case daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY:
                        void this.timeOfDayPlaylist();
                        break;
                    case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                        void this.dayOfWeekPlaylist();
                        break;
                }
            }, 10000);
        });
    }
    getPlaylistDiagnostics() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const diagostics = {
                playlistName: this.name,
                playlistType: this.currentType,
                playlistCurrentIndex: this.currentImageIndex,
                playlistEventCheckerTimeout: {
                    id: String(this.eventCheckerTimeout)
                },
                playlistTimerObject: {
                    timeoutID: String(this.playlistTimer.timeoutID),
                    executionTimeStamp: new Date((_a = this.playlistTimer.executionTimeStamp) !== null && _a !== void 0 ? _a : 0)
                },
                playlistImages: this.images.map(image => {
                    return JSON.stringify(image);
                }),
                playlistInterval: this.interval,
                daemonPID: process.pid
            };
            return diagostics;
        });
    }
}
exports.Playlist = Playlist;
//# sourceMappingURL=playlist.js.map