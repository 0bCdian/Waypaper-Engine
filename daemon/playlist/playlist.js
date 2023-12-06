"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Playlist = void 0;
var daemonTypes_1 = require("../types/daemonTypes");
var config_1 = __importDefault(require("../config/config"));
var notifications_1 = require("../utils/notifications");
var node_path_1 = require("node:path");
var node_child_process_1 = require("node:child_process");
var dbOperationsDaemon_1 = __importDefault(require("../database/dbOperationsDaemon"));
var Playlist = /** @class */ (function () {
    function Playlist() {
        this.images = [];
        this.currentName = '';
        this.currentType = undefined;
        this.currentImageIndex = 0;
        this.interval = 0;
        this.showAnimations = true;
        this.intervalID = undefined;
        this.timeoutID = undefined;
    }
    Playlist.prototype.setImage = function (imageName) {
        var imageLocation = (0, node_path_1.join)(config_1.default.IMAGES_DIR, imageName);
        var command = this.getSwwwCommandFromConfiguration(imageLocation);
        if (command) {
            (0, notifications_1.notifyImageSet)(imageName, imageLocation);
            (0, node_child_process_1.execSync)(command);
        }
    };
    Playlist.prototype.pause = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            clearInterval(this.intervalID);
            clearTimeout(this.timeoutID);
            this.intervalID = undefined;
            this.timeoutID = undefined;
            return "Paused ".concat(this.currentName);
        }
        else {
            return "Cannot pause ".concat(this.currentName, " because it's of type ").concat(this.currentType);
        }
    };
    Playlist.prototype.resume = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            this.timedPlaylist(true);
            return "Resuming ".concat(this.currentName);
        }
        else {
            return "Cannot resume ".concat(this.currentName, " because it is of type ").concat(this.currentType);
        }
    };
    Playlist.prototype.stop = function (setToNull) {
        if (setToNull) {
            dbOperationsDaemon_1.default.setActivePlaylistToNull();
        }
        var playlist_name = this.currentName;
        this.pause();
        this.currentImageIndex = 0;
        this.currentName = '';
        this.currentType = undefined;
        this.interval = 0;
        this.images = [];
        this.showAnimations = true;
        if (playlist_name === '') {
            return {
                action: daemonTypes_1.ACTIONS.STOP_PLAYLIST,
                message: ''
            };
        }
        return {
            action: daemonTypes_1.ACTIONS.STOP_PLAYLIST,
            message: "Stopped ".concat(playlist_name)
        };
    };
    Playlist.prototype.resetInterval = function () {
        clearInterval(this.intervalID);
        this.intervalID = undefined;
        this.timedPlaylist(true);
    };
    Playlist.prototype.nextImage = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
            this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY ||
            undefined) {
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
        this.setImage(this.images[this.currentImageIndex].name);
        try {
            this.updateInDB();
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
        return "Setting:".concat(this.images[this.currentImageIndex].name);
    };
    Playlist.prototype.previousImage = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
            this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY ||
            undefined) {
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
        this.setImage(this.images[this.currentImageIndex].name);
        try {
            this.updateInDB();
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
        return "Setting:".concat(this.images[this.currentImageIndex].name);
    };
    Playlist.prototype.start = function () {
        try {
            var currentPlaylist = dbOperationsDaemon_1.default.getCurrentPlaylist();
            if (currentPlaylist === undefined) {
                return {
                    action: daemonTypes_1.ACTIONS.ERROR,
                    message: 'Database returned undefined from currentPlaylist'
                };
            }
            this.stop(false);
            this.setPlaylist(currentPlaylist);
            switch (this.currentType) {
                case daemonTypes_1.PLAYLIST_TYPES.TIMER:
                    this.timedPlaylist();
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.NEVER:
                    this.neverPlaylist();
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY:
                    this.timeOfDayPlaylist();
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                    this.dayOfWeekPlaylist();
                    break;
                default:
                    this.stop(true);
                    break;
            }
            return {
                action: daemonTypes_1.ACTIONS.START_PLAYLIST,
                message: "Started playlist ".concat(currentPlaylist.name)
            };
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
    };
    Playlist.prototype.updatePlaylist = function () {
        try {
            var newPlaylistInfo = dbOperationsDaemon_1.default.getCurrentPlaylist();
            if (newPlaylistInfo !== undefined &&
                newPlaylistInfo.name === this.currentName) {
                switch (this.currentType) {
                    case daemonTypes_1.PLAYLIST_TYPES.TIMER:
                        if (newPlaylistInfo.interval !== this.interval) {
                            this.stop(false);
                        }
                        this.setPlaylist(newPlaylistInfo);
                        break;
                    case daemonTypes_1.PLAYLIST_TYPES.NEVER:
                        this.images = newPlaylistInfo.images;
                        this.showAnimations = newPlaylistInfo.showAnimations;
                        break;
                    case daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY:
                        this.stop(false);
                        this.setPlaylist(newPlaylistInfo);
                        this.timeOfDayPlaylist();
                        break;
                    case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                        this.stop(false);
                        this.setPlaylist(newPlaylistInfo);
                        this.dayOfWeekPlaylist();
                        break;
                    default:
                        this.stop(true);
                        break;
                }
                return {
                    action: daemonTypes_1.ACTIONS.UPDATE_PLAYLIST,
                    message: "Updated ".concat(newPlaylistInfo.name)
                };
            }
            else {
                (0, notifications_1.notify)('There was a problem updating the playlist, either the names do not match, or the database returned null');
                return {
                    action: daemonTypes_1.ACTIONS.ERROR,
                    message: 'There was a problem updating the playlist, either the names do not match, or the database returned null'
                };
            }
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
    };
    Playlist.prototype.updateInDB = function () {
        try {
            dbOperationsDaemon_1.default.updatePlaylistCurrentIndex(this.currentImageIndex, this.currentName);
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
    };
    Playlist.prototype.setPlaylist = function (currentPlaylist) {
        this.images = currentPlaylist.images;
        this.currentName = currentPlaylist.name;
        this.currentType = currentPlaylist.type;
        this.currentImageIndex = config_1.default.app.settings
            .playlistStartOnFirstImage
            ? 0
            : currentPlaylist.currentImageIndex;
        this.interval = currentPlaylist.interval;
        this.showAnimations = currentPlaylist.showAnimations;
    };
    Playlist.prototype.timedPlaylist = function (resume) {
        var _this = this;
        if (this.interval !== null) {
            if (!resume) {
                this.setImage(this.images[this.currentImageIndex].name);
            }
            this.intervalID = setInterval(function () {
                _this.currentImageIndex++;
                if (_this.currentImageIndex === _this.images.length) {
                    _this.currentImageIndex = 0;
                }
                _this.setImage(_this.images[_this.currentImageIndex].name);
                _this.updateInDB();
            }, this.interval);
        }
        else {
            console.error('Interval is null');
            (0, notifications_1.notify)('Interval is null, something went wrong setting the playlist');
        }
    };
    Playlist.prototype.neverPlaylist = function () {
        this.setImage(this.images[this.currentImageIndex].name);
    };
    Playlist.prototype.timeOfDayPlaylist = function () {
        try {
            var startingIndex = this.findClosestImageIndex();
            if (startingIndex === undefined) {
                (0, notifications_1.notify)('Images have no time, something went wrong');
                this.stop(true);
                return;
            }
            this.currentImageIndex = startingIndex;
            this.setImage(this.images[this.currentImageIndex].name);
            this.timeOfDayPlayer();
        }
        catch (error) {
            (0, notifications_1.notify)("Could not connect to the database\n Error:\n".concat(error));
            process.exit(1);
        }
    };
    Playlist.prototype.dayOfWeekPlaylist = function () {
        var _this = this;
        var now = new Date();
        var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        var millisecondsUntilEndOfDay = endOfDay.getTime() - now.getTime();
        this.setImage(this.images[now.getDay()].name);
        this.intervalID = setTimeout(function () {
            _this.dayOfWeekPlaylist();
        }, millisecondsUntilEndOfDay);
    };
    Playlist.prototype.getSwwwCommandFromConfiguration = function (imagePath, monitors) {
        var swwwConfig = config_1.default.swww.settings;
        var transitionPos = '';
        var inverty = swwwConfig.invertY ? '--invert-y' : '';
        switch (swwwConfig.transitionPositionType) {
            case 'int':
                transitionPos = "".concat(swwwConfig.transitionPositionIntX, ",").concat(swwwConfig.transitionPositionIntY);
                break;
            case 'float':
                transitionPos = "".concat(swwwConfig.transitionPositionFloatX, ",").concat(swwwConfig.transitionPositionFloatY);
                break;
            case 'alias':
                transitionPos = swwwConfig.transitionPosition;
        }
        if (!monitors) {
            var baseCommand = "swww img \"".concat(imagePath, "\" --resize=\"").concat(swwwConfig.resizeType, "\" --fill-color \"").concat(swwwConfig.fillColor, "\" --filter ").concat(swwwConfig.filterType, " --transition-step ").concat(swwwConfig.transitionStep, " --transition-duration ").concat(swwwConfig.transitionDuration, " --transition-fps ").concat(swwwConfig.transitionFPS, " --transition-angle ").concat(swwwConfig.transitionAngle, " --transition-pos ").concat(transitionPos, " ").concat(inverty, " --transition-bezier ").concat(swwwConfig.transitionBezier, " --transition-wave \"").concat(swwwConfig.transitionWaveX, ",").concat(swwwConfig.transitionWaveY, "\"");
            if (!config_1.default.app.settings.swwwAnimations || !this.showAnimations) {
                var command = baseCommand.concat(' --transition-type=none');
                return command;
            }
            else {
                var command = baseCommand.concat(" --transition-type=".concat(swwwConfig.transitionType));
                return command;
            }
        }
    };
    Playlist.prototype.timeOfDayPlayer = function () {
        var _this = this;
        var timeOut = this.calculateMillisecondsUntilNextImage();
        if (timeOut === undefined) {
            (0, notifications_1.notify)("Stopping playlist ".concat(this.currentName));
            this.stop(true);
            return;
        }
        this.timeoutID = setTimeout(function () {
            var newIndex = _this.currentImageIndex + 1;
            if (newIndex === _this.images.length) {
                newIndex = 0;
            }
            _this.currentImageIndex = newIndex;
            _this.setImage(_this.images[_this.currentImageIndex].name);
            _this.timeOfDayPlayer();
        }, timeOut);
    };
    Playlist.prototype.calculateMillisecondsUntilNextImage = function () {
        var nextIndex = this.currentImageIndex + 1 === this.images.length
            ? 0
            : this.currentImageIndex + 1;
        var nextTime = this.images[nextIndex].time;
        if (nextTime === null)
            return undefined;
        var date = new Date();
        var nowInMinutes = date.getHours() * 60 + date.getMinutes();
        var time = nextTime - nowInMinutes;
        if (time < 0) {
            time += 1440;
        }
        time = 60 * time;
        time = time - date.getSeconds();
        time = time * 1000;
        return time;
    };
    Playlist.prototype.findClosestImageIndex = function () {
        var date = new Date();
        var currentTime = date.getHours() * 60 + date.getMinutes();
        var low = 0;
        var high = this.images.length - 1;
        var closestIndex = -1;
        while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            var midTime = this.images[mid].time;
            if (midTime === null)
                return undefined;
            if (midTime === currentTime) {
                return mid; // Found an exact match
            }
            else if (midTime < currentTime) {
                closestIndex = mid; // Update the closest index
                low = mid + 1; // Move to the right half
            }
            else {
                high = mid - 1; // Move to the left half
            }
        }
        return closestIndex;
    };
    Playlist.prototype.setRandomImage = function () {
        try {
            var images = dbOperationsDaemon_1.default.readAllImagesInDB();
            if (images === undefined) {
                return 'There are no images in the database';
            }
            var randomIndex = Math.floor(Math.random() * images.length);
            var randomImage = images[randomIndex].name;
            this.setImage(randomImage);
            return "Setting ".concat(randomImage);
        }
        catch (error) {
            (0, notifications_1.notify)(error);
            process.exit(1);
        }
    };
    return Playlist;
}());
exports.Playlist = Playlist;
