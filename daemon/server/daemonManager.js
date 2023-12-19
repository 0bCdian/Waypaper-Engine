"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.daemonManager = void 0;
var daemonTypes_1 = require("../types/daemonTypes");
var notifications_1 = require("../utils/notifications");
var config_1 = __importDefault(require("../config/config"));
function daemonManager(data, socket, playlistController, daemonServer) {
    var message = JSON.parse(data.toString());
    switch (message.action) {
        case daemonTypes_1.ACTIONS.STOP_DAEMON:
            var stopMessage = playlistController.stop(false);
            (0, notifications_1.notify)(stopMessage.message);
            socket.write(JSON.stringify(stopMessage));
            daemonServer.close();
            process.exit(0);
        case daemonTypes_1.ACTIONS.UPDATE_CONFIG:
            config_1.default.app.update();
            config_1.default.swww.update();
            socket.write(JSON.stringify({ action: daemonTypes_1.ACTIONS.UPDATE_CONFIG }));
            break;
        case daemonTypes_1.ACTIONS.START_PLAYLIST:
            var startMessage = playlistController.start();
            (0, notifications_1.notify)("Starting ".concat(playlistController.currentName));
            socket.write(JSON.stringify(startMessage));
            break;
        case daemonTypes_1.ACTIONS.RANDOM_IMAGE:
            var setImageMessage = playlistController.setRandomImage();
            socket.write(setImageMessage);
            break;
    }
    if (playlistController.currentName !== '') {
        switch (message.action) {
            case daemonTypes_1.ACTIONS.PAUSE_PLAYLIST:
                var pauseMessage = playlistController.pause();
                (0, notifications_1.notify)(pauseMessage);
                socket.write(pauseMessage);
                break;
            case daemonTypes_1.ACTIONS.RESUME_PLAYLIST:
                var resumeMessage = playlistController.resume();
                (0, notifications_1.notify)(resumeMessage);
                socket.write(resumeMessage);
                break;
            case daemonTypes_1.ACTIONS.STOP_PLAYLIST:
                var stopMessage = playlistController.stop(true);
                (0, notifications_1.notify)(JSON.stringify(stopMessage));
                socket.write(JSON.stringify(stopMessage));
                break;
            case daemonTypes_1.ACTIONS.UPDATE_PLAYLIST:
                playlistController.updatePlaylist();
                break;
            case daemonTypes_1.ACTIONS.NEXT_IMAGE:
                var nextImageMessage = playlistController.nextImage();
                socket.write(nextImageMessage);
                break;
            case daemonTypes_1.ACTIONS.PREVIOUS_IMAGE:
                var previousImageMessage = playlistController.previousImage();
                socket.write(previousImageMessage);
                break;
        }
    }
}
exports.daemonManager = daemonManager;
