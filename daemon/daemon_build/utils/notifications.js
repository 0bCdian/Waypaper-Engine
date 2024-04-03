"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = exports.notifyImageSet = void 0;
const node_child_process_1 = require("node:child_process");
const config_1 = require("../config/config");
function notifyImageSet(imageName, imagePath) {
    if (!config_1.configuration.app.settings.notifications)
        return;
    const notifySend = `notify-send -u low -t 2000 -i "${imagePath}" -a "Waypaper Engine" "Waypaper Engine" "Setting image: ${imageName}"`;
    (0, node_child_process_1.exec)(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            console.error(err);
        }
    });
}
exports.notifyImageSet = notifyImageSet;
function notify(message) {
    if (!config_1.configuration.app.settings.notifications)
        return;
    const notifySend = `notify-send -u normal -t 2000 -a "Waypaper Engine" "Waypaper Engine" "${message}"`;
    (0, node_child_process_1.exec)(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            console.error(err);
        }
    });
}
exports.notify = notify;
//# sourceMappingURL=notifications.js.map