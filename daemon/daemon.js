"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var sequelize_1 = require("sequelize");
var net = __importStar(require("node:net"));
var fs = __importStar(require("node:fs"));
var node_child_process_1 = require("node:child_process");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var node_process_1 = __importDefault(require("node:process"));
node_process_1.default.title = 'waypaperdaemon';
var SWWW_VERSION;
(function (SWWW_VERSION) {
    SWWW_VERSION["SYSTEM_INSTALLED"] = "system-installed";
    SWWW_VERSION["NOT_INSTALLED"] = "not-installed";
})(SWWW_VERSION || (SWWW_VERSION = {}));
var PLAYLIST_TYPES;
(function (PLAYLIST_TYPES) {
    PLAYLIST_TYPES["TIMER"] = "timer";
    PLAYLIST_TYPES["NEVER"] = "never";
    PLAYLIST_TYPES["TIME_OF_DAY"] = "timeofday";
    PLAYLIST_TYPES["DAY_OF_WEEK"] = "dayofweek";
})(PLAYLIST_TYPES || (PLAYLIST_TYPES = {}));
var ORDER_TYPES;
(function (ORDER_TYPES) {
    ORDER_TYPES["ORDERED"] = "ordered";
    ORDER_TYPES["RANDOM"] = "random";
})(ORDER_TYPES || (ORDER_TYPES = {}));
var ACTIONS;
(function (ACTIONS) {
    ACTIONS["NEXT_IMAGE"] = "next-image";
    ACTIONS["PREVIOUS_IMAGE"] = "previous-image";
    ACTIONS["START_PLAYLIST"] = "start-playlist";
    ACTIONS["STOP_DAEMON"] = "stop-daemon";
    ACTIONS["PAUSE_PLAYLIST"] = "pause-playlist";
    ACTIONS["RESUME_PLAYLIST"] = "resume-playlist";
    ACTIONS["STOP_PLAYLIST"] = "stop-playlist";
})(ACTIONS || (ACTIONS = {}));
var sequelize = new sequelize_1.Sequelize({
    dialect: 'sqlite',
    storage: (0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper', 'imagesDB.sqlite3')
});
var IMAGES_DIR = (0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper', 'images');
var SOCKET_PATH = '/tmp/waypaper_daemon.sock';
var setImage = function (swwwBin, swwwOptions, imageName) {
    console.log('Setting image: ', imageName);
    console.log('swwwBin: ', swwwBin);
    console.log('swwwOptions: ', swwwOptions);
    (0, node_child_process_1.execSync)("".concat(swwwBin, " img ").concat(swwwOptions.join(' '), " \"").concat((0, node_path_1.join)(IMAGES_DIR, imageName), "\""));
};
var Playlist = {
    state: false,
    images: [''],
    currentName: '',
    currentType: PLAYLIST_TYPES.NEVER,
    currentImageIndex: 0,
    interval: 0,
    swwwBin: '',
    swwwOptions: [''],
    pause: function () {
        Playlist.state = false;
    },
    resume: function () {
        Playlist.start(Playlist.currentName, Playlist.swwwBin, Playlist.swwwOptions);
    },
    stop: function () {
        Playlist.state = false;
        Playlist.currentImageIndex = 0;
        Playlist.currentName = '';
        Playlist.currentType = PLAYLIST_TYPES.NEVER;
        Playlist.interval = 0;
        Playlist.images = [''];
        Playlist.swwwBin = '';
        Playlist.swwwOptions = [''];
    },
    nextImage: function () {
        Playlist.currentImageIndex++;
        if (Playlist.currentImageIndex === Playlist.images.length) {
            Playlist.currentImageIndex = 0;
        }
        setImage(Playlist.swwwBin, Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex]);
    },
    previousImage: function () {
        Playlist.currentImageIndex--;
        if (Playlist.currentImageIndex < 0) {
            Playlist.currentImageIndex = Playlist.images.length - 1;
        }
        setImage(Playlist.swwwBin, Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex]);
    },
    calculateInterval: function (hours, minutes) {
        return hours * 60 * 60 * 1000 + minutes * 60 * 1000;
    },
    start: function (playlistName, swwwBin, swwwOptions) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Playlist.setPlaylist(playlistName, swwwBin, swwwOptions)];
                case 1:
                    _a.sent();
                    switch (Playlist.currentType) {
                        case PLAYLIST_TYPES.TIMER:
                            Playlist.timedPlaylist();
                            break;
                        case PLAYLIST_TYPES.NEVER:
                            Playlist.neverPlaylist();
                            break;
                        case PLAYLIST_TYPES.TIME_OF_DAY:
                            Playlist.timeOfDayPlaylist();
                            break;
                        case PLAYLIST_TYPES.DAY_OF_WEEK:
                            Playlist.dayOfWeekPlaylist();
                            break;
                        default:
                            throw new Error('Invalid playlist type');
                    }
                    return [2 /*return*/];
            }
        });
    }); },
    sleep: function (ms) { return new Promise(function (r) { return setTimeout(r, ms); }); },
    updateInDB: function (imageIndex, playlistName) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, sequelize.authenticate()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, sequelize.query("UPDATE Playlists SET currentImageIndex = ".concat(imageIndex, " WHERE name = '").concat(playlistName, "'"))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error(error_1);
                    throw new Error('Could not update playlist in DB');
                case 4: return [2 /*return*/];
            }
        });
    }); },
    getFromDB: function (playlistName) { return __awaiter(void 0, void 0, void 0, function () {
        var playlistArray, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, sequelize.authenticate()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, sequelize.query("SELECT * FROM Playlists WHERE name = '".concat(playlistName, "'"))];
                case 2:
                    playlistArray = (_a.sent())[0];
                    if (!playlistArray.length)
                        throw new Error('Playlist not found');
                    playlistArray[0].images = JSON.parse(playlistArray[0].images);
                    return [2 /*return*/, playlistArray[0]];
                case 3:
                    error_2 = _a.sent();
                    console.error(error_2);
                    throw new Error('Could not get playlist from DB');
                case 4: return [2 /*return*/];
            }
        });
    }); },
    setPlaylist: function (playlistName, swwwBin, swwwOptions) { return __awaiter(void 0, void 0, void 0, function () {
        var currentPlaylist, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Playlist.getFromDB(playlistName)];
                case 1:
                    currentPlaylist = _a.sent();
                    Playlist.state = true;
                    Playlist.images = currentPlaylist.images;
                    Playlist.currentName = playlistName;
                    Playlist.swwwBin = swwwBin;
                    Playlist.swwwOptions = swwwOptions;
                    Playlist.currentType = currentPlaylist.type;
                    Playlist.currentImageIndex = currentPlaylist.currentImageIndex;
                    Playlist.interval = Playlist.calculateInterval(currentPlaylist.hours, currentPlaylist.minutes);
                    console.log('Playlist set');
                    console.log(Playlist.images, Playlist.currentImageIndex);
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error(error_3);
                    // implement notify function
                    throw new Error('Could not set playlist');
                case 3: return [2 /*return*/];
            }
        });
    }); },
    timedPlaylist: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('timedPlaylist', Playlist.currentImageIndex, Playlist.images, Playlist.currentName);
                    setImage(Playlist.swwwBin, Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex]);
                    _a.label = 1;
                case 1:
                    if (!Playlist.state) return [3 /*break*/, 4];
                    return [4 /*yield*/, Playlist.sleep(Playlist.interval)];
                case 2:
                    _a.sent();
                    Playlist.currentImageIndex++;
                    if (Playlist.currentImageIndex === Playlist.images.length) {
                        Playlist.currentImageIndex = 0;
                    }
                    setImage(Playlist.swwwBin, Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex]);
                    return [4 /*yield*/, Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); },
    neverPlaylist: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setImage(Playlist.swwwBin, Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex]);
            return [2 /*return*/];
        });
    }); },
    timeOfDayPlaylist: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); },
    dayOfWeekPlaylist: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); }
};
function daemonManager(data) {
    return __awaiter(this, void 0, void 0, function () {
        var message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    message = JSON.parse(data.toString());
                    if (!(message.action === ACTIONS.START_PLAYLIST && message.payload)) return [3 /*break*/, 2];
                    Playlist.stop();
                    return [4 /*yield*/, Playlist.start(message.payload.playlistName, message.payload.swwwBin, message.payload.swwwOptions)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    if (message.action === ACTIONS.PAUSE_PLAYLIST) {
                        Playlist.pause();
                    }
                    if (message.action === ACTIONS.RESUME_PLAYLIST) {
                        Playlist.resume();
                    }
                    if (message.action === ACTIONS.STOP_PLAYLIST) {
                        Playlist.stop();
                    }
                    if (message.action === ACTIONS.NEXT_IMAGE) {
                        Playlist.nextImage();
                    }
                    if (message.action === ACTIONS.PREVIOUS_IMAGE) {
                        Playlist.previousImage();
                    }
                    if (message.action === ACTIONS.STOP_DAEMON) {
                        Playlist.stop();
                        sequelize.close();
                        daemonServer.close();
                    }
                    return [2 /*return*/];
            }
        });
    });
}
var daemonServer = net.createServer(function (socket) {
    socket.on('data', daemonManager);
});
daemonServer.on('error', function (err) {
    if (err.message.includes('EADDRINUSE')) {
        fs.unlinkSync(SOCKET_PATH);
        daemonServer.listen(SOCKET_PATH);
    }
    else {
        console.error(err);
    }
});
daemonServer.listen(SOCKET_PATH);
node_process_1.default.on('SIGTERM', function () {
    daemonServer.close();
});
node_process_1.default.on('SIGINT', function () {
    daemonServer.close();
});
