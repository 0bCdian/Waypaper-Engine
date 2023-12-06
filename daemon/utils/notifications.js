"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = exports.notifyImageSet = void 0;
var node_child_process_1 = require("node:child_process");
var config_1 = __importDefault(require("../config/config"));
function notifyImageSet(imageName, imagePath) {
    if (!config_1.default.app.settings.notifications)
        return;
    var notifySend = "notify-send -u low -t 2000 -i \"".concat(imagePath, "\" -a \"Waypaper Engine\" \"Waypaper Engine\" \"Setting image: ").concat(imageName, "\"");
    (0, node_child_process_1.exec)(notifySend, function (err, _stdout, _stderr) {
        if (err) {
            console.error(err);
        }
    });
}
exports.notifyImageSet = notifyImageSet;
function notify(message) {
    if (!config_1.default.app.settings.notifications)
        return;
    var notifySend = "notify-send -u normal -t 2000 -a \"Waypaper Engine\" \"Waypaper Engine\" \"".concat(message, "\"");
    (0, node_child_process_1.exec)(notifySend, function (err, _stdout, _stderr) {
        if (err) {
            console.error(err);
        }
    });
}
exports.notify = notify;
