"use strict";
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
var __generator =
    (this && this.__generator) ||
    function (thisArg, body) {
        var _ = {
                label: 0,
                sent: function () {
                    if (t[0] & 1) throw t[1];
                    return t[1];
                },
                trys: [],
                ops: []
            },
            f,
            y,
            t,
            g;
        return (
            (g = { next: verb(0), throw: verb(1), return: verb(2) }),
            typeof Symbol === "function" &&
                (g[Symbol.iterator] = function () {
                    return this;
                }),
            g
        );
        function verb(n) {
            return function (v) {
                return step([n, v]);
            };
        }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while ((g && ((g = 0), op[0] && (_ = 0)), _))
                try {
                    if (
                        ((f = 1),
                        y &&
                            (t =
                                op[0] & 2
                                    ? y["return"]
                                    : op[0]
                                      ? y["throw"] ||
                                        ((t = y["return"]) && t.call(y), 0)
                                      : y.next) &&
                            !(t = t.call(y, op[1])).done)
                    )
                        return t;
                    if (((y = 0), t)) op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (
                                !((t = _.trys),
                                (t = t.length > 0 && t[t.length - 1])) &&
                                (op[0] === 6 || op[0] === 2)
                            ) {
                                _ = 0;
                                continue;
                            }
                            if (
                                op[0] === 3 &&
                                (!t || (op[1] > t[0] && op[1] < t[3]))
                            ) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2]) _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                } catch (e) {
                    op = [6, e];
                    y = 0;
                } finally {
                    f = t = 0;
                }
            if (op[0] & 5) throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Playlist = void 0;
var daemonTypes_1 = require("../types/daemonTypes");
var config_1 = __importDefault(require("../config/config"));
var notifications_1 = require("../utils/notifications");
var node_path_1 = require("node:path");
var node_child_process_1 = require("node:child_process");
var node_util_1 = require("node:util");
var dbOperationsDaemon_1 = __importDefault(
    require("../database/dbOperationsDaemon")
);
var execPromisified = (0, node_util_1.promisify)(node_child_process_1.exec);
var Playlist = /** @class */ (function () {
    function Playlist() {
        this.images = [];
        this.currentName = "";
        this.currentType = undefined;
        this.currentImageIndex = 0;
        this.interval = 0;
        this.showAnimations = true;
        this.playlistTimer = {
            timeoutID: undefined,
            executionTimeStamp: undefined
        };
        this.eventCheckerTimeout = undefined;
    }
    Playlist.prototype.setImage = function (imageName) {
        return __awaiter(this, void 0, void 0, function () {
            var imageLocation, command, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        imageLocation = (0, node_path_1.join)(
                            config_1.default.IMAGES_DIR,
                            imageName
                        );
                        command =
                            this.getSwwwCommandFromConfiguration(imageLocation);
                        (0, notifications_1.notifyImageSet)(
                            imageName,
                            imageLocation
                        );
                        return [4 /*yield*/, execPromisified(command)];
                    case 1:
                        _a.sent();
                        if (!(config_1.default.script !== undefined))
                            return [3 /*break*/, 3];
                        return [
                            4 /*yield*/,
                            execPromisified(
                                ""
                                    .concat(config_1.default.script, " ")
                                    .concat(imageLocation)
                            )
                        ];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        (0, notifications_1.notify)(error_1);
                        return [3 /*break*/, 5];
                    case 5:
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.pause = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            clearTimeout(this.playlistTimer.timeoutID);
            this.playlistTimer.timeoutID = undefined;
            return "Paused ".concat(this.currentName);
        } else {
            return "Cannot pause "
                .concat(this.currentName, " because it's of type ")
                .concat(this.currentType);
        }
    };
    Playlist.prototype.resume = function () {
        if (this.currentType === daemonTypes_1.PLAYLIST_TYPES.TIMER) {
            this.timedPlaylist(true);
            return "Resuming ".concat(this.currentName);
        } else {
            return "Cannot resume "
                .concat(this.currentName, " because it is of type ")
                .concat(this.currentType);
        }
    };
    Playlist.prototype.stop = function (setToNull) {
        if (setToNull) {
            dbOperationsDaemon_1.default.setActivePlaylistToNull();
        }
        var playlist_name = this.currentName;
        this.pause();
        this.currentImageIndex = 0;
        this.currentName = "";
        this.currentType = undefined;
        this.interval = 0;
        this.images = [];
        this.showAnimations = true;
        if (this.eventCheckerTimeout !== undefined) {
            clearInterval(this.eventCheckerTimeout);
        }
        if (this.playlistTimer.timeoutID !== undefined) {
            clearTimeout(this.playlistTimer.timeoutID);
        }
        this.playlistTimer.timeoutID = undefined;
        this.playlistTimer.executionTimeStamp = undefined;
        this.eventCheckerTimeout = undefined;
        if (playlist_name === "") {
            return {
                action: daemonTypes_1.ACTIONS.STOP_PLAYLIST,
                message: ""
            };
        }
        return {
            action: daemonTypes_1.ACTIONS.STOP_PLAYLIST,
            message: "Stopped ".concat(playlist_name)
        };
    };
    Playlist.prototype.resetInterval = function () {
        clearTimeout(this.playlistTimer.timeoutID);
        this.playlistTimer.timeoutID = undefined;
        this.timedPlaylist(true);
    };
    Playlist.prototype.nextImage = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (
                            this.currentType ===
                                daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
                            this.currentType ===
                                daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY ||
                            undefined
                        ) {
                            (0, notifications_1.notify)(
                                "Cannot change image in this type of playlist"
                            );
                            return [
                                2 /*return*/,
                                "Cannot change image in this type of playlist"
                            ];
                        }
                        this.currentImageIndex++;
                        if (this.currentImageIndex === this.images.length) {
                            this.currentImageIndex = 0;
                        }
                        if (
                            this.currentType ===
                            daemonTypes_1.PLAYLIST_TYPES.TIMER
                        ) {
                            this.resetInterval();
                        }
                        return [
                            4 /*yield*/,
                            this.setImage(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                    case 1:
                        _a.sent();
                        try {
                            this.updateInDB();
                        } catch (error) {
                            (0, notifications_1.notify)(
                                "Could not connect to the database\n Error:\n".concat(
                                    error
                                )
                            );
                            throw error;
                        }
                        return [
                            2 /*return*/,
                            "Setting:".concat(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                }
            });
        });
    };
    Playlist.prototype.previousImage = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (
                            this.currentType ===
                                daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK ||
                            this.currentType ===
                                daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY ||
                            undefined
                        ) {
                            (0, notifications_1.notify)(
                                "Cannot change image in this type of playlist"
                            );
                            return [
                                2 /*return*/,
                                "Cannot change image in this type of playlist"
                            ];
                        }
                        this.currentImageIndex--;
                        if (this.currentImageIndex < 0) {
                            this.currentImageIndex = this.images.length - 1;
                        }
                        if (
                            this.currentType ===
                            daemonTypes_1.PLAYLIST_TYPES.TIMER
                        ) {
                            this.resetInterval();
                        }
                        return [
                            4 /*yield*/,
                            this.setImage(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                    case 1:
                        _a.sent();
                        try {
                            this.updateInDB();
                        } catch (error) {
                            (0, notifications_1.notify)(
                                "Could not connect to the database\n Error:\n".concat(
                                    error
                                )
                            );
                            throw error;
                        }
                        return [
                            2 /*return*/,
                            "Setting:".concat(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                }
            });
        });
    };
    Playlist.prototype.start = function () {
        var _this = this;
        try {
            var currentPlaylist =
                dbOperationsDaemon_1.default.getCurrentPlaylist();
            if (currentPlaylist === undefined) {
                return {
                    action: daemonTypes_1.ACTIONS.ERROR,
                    message: "Database returned undefined from currentPlaylist"
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
                    this.timeOfDayPlaylist().then(function () {
                        _this.checkMissedEvents();
                    });
                    break;
                case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                    this.dayOfWeekPlaylist().then(function () {
                        return _this.checkMissedEvents();
                    });
                    break;
                default:
                    this.stop(true);
                    break;
            }
            return {
                action: daemonTypes_1.ACTIONS.START_PLAYLIST,
                message: "Started playlist ".concat(currentPlaylist.name)
            };
        } catch (error) {
            (0, notifications_1.notify)(
                "Could not connect to the database\n Error:\n".concat(error)
            );
            throw error;
        }
    };
    Playlist.prototype.updatePlaylist = function () {
        var _this = this;
        try {
            var newPlaylistInfo =
                dbOperationsDaemon_1.default.getCurrentPlaylist();
            if (
                newPlaylistInfo !== undefined &&
                newPlaylistInfo.name === this.currentName
            ) {
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
                        this.timeOfDayPlaylist().then(function () {
                            _this.checkMissedEvents();
                        });
                        break;
                    case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                        this.stop(false);
                        this.setPlaylist(newPlaylistInfo);
                        this.dayOfWeekPlaylist().then(function () {
                            _this.checkMissedEvents();
                        });
                        break;
                    default:
                        this.stop(true);
                        break;
                }
                return {
                    action: daemonTypes_1.ACTIONS.UPDATE_PLAYLIST,
                    message: "Updated ".concat(newPlaylistInfo.name)
                };
            } else {
                (0, notifications_1.notify)(
                    "There was a problem updating the playlist, either the names do not match, or the database returned null"
                );
                return {
                    action: daemonTypes_1.ACTIONS.ERROR,
                    message:
                        "There was a problem updating the playlist, either the names do not match, or the database returned null"
                };
            }
        } catch (error) {
            (0, notifications_1.notify)(
                "Could not connect to the database\n Error:\n".concat(error)
            );
            throw error;
        }
    };
    Playlist.prototype.updateInDB = function () {
        try {
            dbOperationsDaemon_1.default.updatePlaylistCurrentIndex(
                this.currentImageIndex,
                this.currentName
            );
        } catch (error) {
            (0, notifications_1.notify)(
                "Could not connect to the database\n Error:\n".concat(error)
            );
            throw error;
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
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.interval !== null)) return [3 /*break*/, 3];
                        if (!!resume) return [3 /*break*/, 2];
                        return [
                            4 /*yield*/,
                            this.setImage(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.playlistTimer.timeoutID = setInterval(function () {
                            return __awaiter(
                                _this,
                                void 0,
                                void 0,
                                function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                this.currentImageIndex++;
                                                if (
                                                    this.currentImageIndex ===
                                                    this.images.length
                                                ) {
                                                    this.currentImageIndex = 0;
                                                }
                                                return [
                                                    4 /*yield*/,
                                                    this.setImage(
                                                        this.images[
                                                            this
                                                                .currentImageIndex
                                                        ].name
                                                    )
                                                ];
                                            case 1:
                                                _a.sent();
                                                this.updateInDB();
                                                return [2 /*return*/];
                                        }
                                    });
                                }
                            );
                        }, this.interval);
                        return [3 /*break*/, 4];
                    case 3:
                        console.error("Interval is null");
                        (0, notifications_1.notify)(
                            "Interval is null, something went wrong setting the playlist"
                        );
                        _a.label = 4;
                    case 4:
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.neverPlaylist = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        return [
                            4 /*yield*/,
                            this.setImage(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.timeOfDayPlaylist = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startingIndex, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        startingIndex = this.findClosestImageIndex();
                        if (startingIndex === undefined) {
                            (0, notifications_1.notify)(
                                "Images have no time, something went wrong"
                            );
                            this.stop(true);
                            return [2 /*return*/];
                        }
                        this.currentImageIndex =
                            startingIndex < 0
                                ? this.images.length - 1
                                : startingIndex;
                        return [
                            4 /*yield*/,
                            this.setImage(
                                this.images[this.currentImageIndex].name
                            )
                        ];
                    case 1:
                        _a.sent();
                        this.timeOfDayPlayer();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        (0, notifications_1.notify)(
                            "Could not connect to the database\n Error:\n".concat(
                                error_2
                            )
                        );
                        throw error_2;
                    case 3:
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.dayOfWeekPlaylist = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, endOfDay, millisecondsUntilEndOfDay, imageIndexToSet;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date();
                        endOfDay = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate() + 1,
                            0,
                            0,
                            0
                        );
                        millisecondsUntilEndOfDay =
                            endOfDay.getTime() - now.getTime();
                        imageIndexToSet = now.getDay();
                        if (imageIndexToSet > this.images.length) {
                            imageIndexToSet = this.images.length - 1;
                        }
                        return [
                            4 /*yield*/,
                            this.setImage(this.images[imageIndexToSet].name)
                        ];
                    case 1:
                        _a.sent();
                        clearTimeout(this.playlistTimer.timeoutID);
                        this.playlistTimer.timeoutID = setTimeout(function () {
                            _this.dayOfWeekPlaylist();
                        }, millisecondsUntilEndOfDay);
                        this.playlistTimer.executionTimeStamp =
                            millisecondsUntilEndOfDay + Date.now();
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.getSwwwCommandFromConfiguration = function (imagePath) {
        var swwwConfig = config_1.default.swww.settings;
        var transitionPos = "";
        var inverty = swwwConfig.invertY ? "--invert-y" : "";
        switch (swwwConfig.transitionPositionType) {
            case "int":
                transitionPos = ""
                    .concat(swwwConfig.transitionPositionIntX, ",")
                    .concat(swwwConfig.transitionPositionIntY);
                break;
            case "float":
                transitionPos = ""
                    .concat(swwwConfig.transitionPositionFloatX, ",")
                    .concat(swwwConfig.transitionPositionFloatY);
                break;
            case "alias":
                transitionPos = swwwConfig.transitionPosition;
        }
        var baseCommand = 'swww img "'
            .concat(imagePath, '" --resize="')
            .concat(swwwConfig.resizeType, '" --fill-color "')
            .concat(swwwConfig.fillColor, '" --filter ')
            .concat(swwwConfig.filterType, " --transition-step ")
            .concat(swwwConfig.transitionStep, " --transition-duration ")
            .concat(swwwConfig.transitionDuration, " --transition-fps ")
            .concat(swwwConfig.transitionFPS, " --transition-angle ")
            .concat(swwwConfig.transitionAngle, " --transition-pos ")
            .concat(transitionPos, " ")
            .concat(inverty, " --transition-bezier ")
            .concat(swwwConfig.transitionBezier, ' --transition-wave "')
            .concat(swwwConfig.transitionWaveX, ",")
            .concat(swwwConfig.transitionWaveY, '"');
        if (
            !config_1.default.app.settings.swwwAnimations ||
            !this.showAnimations
        ) {
            var command = baseCommand.concat(" --transition-type=none");
            return command;
        } else {
            var command = baseCommand.concat(
                " --transition-type=".concat(swwwConfig.transitionType)
            );
            return command;
        }
    };
    Playlist.prototype.timeOfDayPlayer = function () {
        var _this = this;
        var timeOut = this.calculateMillisecondsUntilNextImage();
        if (timeOut === undefined) {
            (0, notifications_1.notify)(
                "Stopping playlist ".concat(this.currentName)
            );
            this.stop(true);
            return;
        }
        clearTimeout(this.playlistTimer.timeoutID);
        this.playlistTimer.timeoutID = setTimeout(function () {
            return __awaiter(_this, void 0, void 0, function () {
                var newIndex;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            newIndex = this.currentImageIndex + 1;
                            if (newIndex === this.images.length) {
                                newIndex = 0;
                            }
                            this.currentImageIndex = newIndex;
                            return [
                                4 /*yield*/,
                                this.setImage(
                                    this.images[this.currentImageIndex].name
                                )
                            ];
                        case 1:
                            _a.sent();
                            this.timeOfDayPlayer();
                            return [2 /*return*/];
                    }
                });
            });
        }, timeOut);
        this.playlistTimer.executionTimeStamp = timeOut + Date.now();
    };
    Playlist.prototype.calculateMillisecondsUntilNextImage = function () {
        var nextIndex =
            this.currentImageIndex + 1 === this.images.length
                ? 0
                : this.currentImageIndex + 1;
        var nextTime = this.images[nextIndex].time;
        if (nextTime === null) return undefined;
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
            if (midTime === null) return undefined;
            if (midTime === currentTime) {
                return mid;
            } else if (midTime < currentTime) {
                closestIndex = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return closestIndex;
    };
    Playlist.prototype.setRandomImage = function () {
        return __awaiter(this, void 0, void 0, function () {
            var images, randomIndex, randomImage, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        images =
                            dbOperationsDaemon_1.default.readAllImagesInDB();
                        if (images === undefined) {
                            return [
                                2 /*return*/,
                                "There are no images in the database"
                            ];
                        }
                        randomIndex = Math.floor(Math.random() * images.length);
                        randomImage = images[randomIndex].name;
                        return [4 /*yield*/, this.setImage(randomImage)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, "Setting ".concat(randomImage)];
                    case 2:
                        error_3 = _a.sent();
                        (0, notifications_1.notify)(error_3);
                        throw error_3;
                    case 3:
                        return [2 /*return*/];
                }
            });
        });
    };
    Playlist.prototype.checkMissedEvents = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                clearTimeout(this.eventCheckerTimeout);
                this.eventCheckerTimeout = setInterval(function () {
                    var now = Date.now();
                    if (
                        _this.playlistTimer.executionTimeStamp === undefined ||
                        now < _this.playlistTimer.executionTimeStamp ||
                        _this.playlistTimer.timeoutID === undefined ||
                        _this.currentType === undefined
                    ) {
                        return;
                    }
                    clearTimeout(_this.playlistTimer.timeoutID);
                    switch (_this.currentType) {
                        case daemonTypes_1.PLAYLIST_TYPES.TIME_OF_DAY:
                            _this.timeOfDayPlaylist();
                            break;
                        case daemonTypes_1.PLAYLIST_TYPES.DAY_OF_WEEK:
                            _this.dayOfWeekPlaylist();
                            break;
                    }
                }, 10000);
                return [2 /*return*/];
            });
        });
    };
    Playlist.prototype.getPlaylistDiagnostics = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var diagostics;
            return __generator(this, function (_b) {
                diagostics = {
                    playlistName: this.currentName,
                    playlistType: this.currentType,
                    playlistCurrentIndex: this.currentImageIndex,
                    playlistEventCheckerTimeout: {
                        id: String(this.eventCheckerTimeout)
                    },
                    playlistTimerObject: {
                        timeoutID: String(this.playlistTimer.timeoutID),
                        executionTimeStamp: new Date(
                            (_a = this.playlistTimer.executionTimeStamp) !==
                                null && _a !== void 0
                                ? _a
                                : 0
                        )
                    },
                    playlistImages: this.images.map(function (image) {
                        return JSON.stringify(image);
                    }),
                    playlistInterval: this.interval,
                    daemonPID: process.pid
                };
                return [2 /*return*/, diagostics];
            });
        });
    };
    return Playlist;
})();
exports.Playlist = Playlist;
