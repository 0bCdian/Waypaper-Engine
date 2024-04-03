"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const daemonManager_1 = require("./server/daemonManager");
const checkDependencies_1 = require("./utils/checkDependencies");
const notifications_1 = require("./utils/notifications");
const config_1 = require("./config/config");
if ((0, checkDependencies_1.isWaypaperDaemonRunning)()) {
    console.error('Another instance is already running');
    process.exit(2);
}
const scriptFlag = process.argv.find(arg => {
    return arg.includes('--script');
});
if (scriptFlag !== undefined) {
    const userScriptLocation = scriptFlag.split('=')[1];
    config_1.configuration.script = userScriptLocation;
}
process.title = 'wpe-daemon';
try {
    const daemonManager = new daemonManager_1.DaemonManager();
    process.on('SIGTERM', function () {
        (0, notifications_1.notify)('Exiting daemon');
        daemonManager.serverInstance.close();
        daemonManager.cleanUp();
        process.exit(0);
    });
    process.on('SIGINT', () => {
        (0, notifications_1.notify)('Exiting daemon');
        daemonManager.serverInstance.close();
        daemonManager.cleanUp();
        process.exit(0);
    });
}
catch (error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=daemon.js.map