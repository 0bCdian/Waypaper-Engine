"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWaypaperDaemonRunning = void 0;
const node_child_process_1 = require("node:child_process");
const notifications_1 = require("./notifications");
function checkIfSwwwIsInstalled() {
    try {
        (0, node_child_process_1.execSync)(`swww --version`, { encoding: "utf-8" });
    }
    catch (error) {
        (0, notifications_1.notify)(`Swww is not installed or not in the path, please find instructions in the README.md on how to install it \n \n ${error}`);
        throw new Error(`swww is not installed, please find instructions in the README.md on how to install it  \n \n ${error}`);
    }
}
function isSwwwDaemonRunning() {
    checkIfSwwwIsInstalled();
    try {
        (0, node_child_process_1.execSync)(`ps -A | grep "swww-daemon"`, { encoding: "utf-8" });
    }
    catch (error) {
        (0, node_child_process_1.execSync)("swww init", { shell: "/bin/sh" });
    }
}
function isWaypaperDaemonRunning() {
    isSwwwDaemonRunning();
    try {
        const stdout = (0, node_child_process_1.execSync)("pidof wpe-daemon", { encoding: "utf-8" });
        (0, notifications_1.notify)(`Waypaper Engine daemon already running,process pid: ${stdout}`);
        return true;
    }
    catch (_err) {
        return false;
    }
}
exports.isWaypaperDaemonRunning = isWaypaperDaemonRunning;
//# sourceMappingURL=checkDependencies.js.map