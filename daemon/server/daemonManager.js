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
exports.daemonManager = void 0;
var daemonTypes_1 = require("../types/daemonTypes");
var notifications_1 = require("../utils/notifications");
var config_1 = __importDefault(require("../config/config"));
function daemonManager(data, socket, playlistController, daemonServer) {
    return __awaiter(this, void 0, void 0, function () {
        var message,
            _a,
            stopMessage,
            startMessage,
            setImageMessage,
            diagnostics,
            _b,
            pauseMessage,
            resumeMessage,
            stopMessage,
            nextImageMessage,
            previousImageMessage;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    message = JSON.parse(data.toString());
                    _a = message.action;
                    switch (_a) {
                        case daemonTypes_1.ACTIONS.STOP_DAEMON:
                            return [3 /*break*/, 1];
                        case daemonTypes_1.ACTIONS.UPDATE_CONFIG:
                            return [3 /*break*/, 2];
                        case daemonTypes_1.ACTIONS.START_PLAYLIST:
                            return [3 /*break*/, 3];
                        case daemonTypes_1.ACTIONS.RANDOM_IMAGE:
                            return [3 /*break*/, 4];
                        case daemonTypes_1.ACTIONS.GET_INFO:
                            return [3 /*break*/, 6];
                    }
                    return [3 /*break*/, 8];
                case 1:
                    stopMessage = playlistController.stop(false);
                    (0, notifications_1.notify)(stopMessage.message);
                    socket.write(JSON.stringify(stopMessage));
                    daemonServer.close();
                    process.exit(0);
                    _c.label = 2;
                case 2:
                    config_1.default.app.update();
                    config_1.default.swww.update();
                    socket.write(
                        JSON.stringify({
                            action: daemonTypes_1.ACTIONS.UPDATE_CONFIG
                        })
                    );
                    return [3 /*break*/, 8];
                case 3:
                    startMessage = playlistController.start();
                    (0, notifications_1.notify)(
                        "Starting ".concat(playlistController.currentName)
                    );
                    socket.write(JSON.stringify(startMessage));
                    return [3 /*break*/, 8];
                case 4:
                    return [4 /*yield*/, playlistController.setRandomImage()];
                case 5:
                    setImageMessage = _c.sent();
                    socket.write(setImageMessage);
                    return [3 /*break*/, 8];
                case 6:
                    return [
                        4 /*yield*/,
                        playlistController.getPlaylistDiagnostics()
                    ];
                case 7:
                    diagnostics = _c.sent();
                    socket.write(JSON.stringify(diagnostics));
                    return [3 /*break*/, 8];
                case 8:
                    if (!(playlistController.currentName !== ""))
                        return [3 /*break*/, 17];
                    _b = message.action;
                    switch (_b) {
                        case daemonTypes_1.ACTIONS.PAUSE_PLAYLIST:
                            return [3 /*break*/, 9];
                        case daemonTypes_1.ACTIONS.RESUME_PLAYLIST:
                            return [3 /*break*/, 10];
                        case daemonTypes_1.ACTIONS.STOP_PLAYLIST:
                            return [3 /*break*/, 11];
                        case daemonTypes_1.ACTIONS.UPDATE_PLAYLIST:
                            return [3 /*break*/, 12];
                        case daemonTypes_1.ACTIONS.NEXT_IMAGE:
                            return [3 /*break*/, 13];
                        case daemonTypes_1.ACTIONS.PREVIOUS_IMAGE:
                            return [3 /*break*/, 15];
                    }
                    return [3 /*break*/, 17];
                case 9:
                    pauseMessage = playlistController.pause();
                    (0, notifications_1.notify)(pauseMessage);
                    socket.write(pauseMessage);
                    return [3 /*break*/, 17];
                case 10:
                    resumeMessage = playlistController.resume();
                    (0, notifications_1.notify)(resumeMessage);
                    socket.write(resumeMessage);
                    return [3 /*break*/, 17];
                case 11:
                    stopMessage = playlistController.stop(true);
                    (0, notifications_1.notify)(JSON.stringify(stopMessage));
                    socket.write(JSON.stringify(stopMessage));
                    return [3 /*break*/, 17];
                case 12:
                    playlistController.updatePlaylist();
                    return [3 /*break*/, 17];
                case 13:
                    return [4 /*yield*/, playlistController.nextImage()];
                case 14:
                    nextImageMessage = _c.sent();
                    socket.write(nextImageMessage);
                    return [3 /*break*/, 17];
                case 15:
                    return [4 /*yield*/, playlistController.previousImage()];
                case 16:
                    previousImageMessage = _c.sent();
                    socket.write(previousImageMessage);
                    return [3 /*break*/, 17];
                case 17:
                    return [2 /*return*/];
            }
        });
    });
}
exports.daemonManager = daemonManager;
