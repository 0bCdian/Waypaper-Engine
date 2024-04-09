import { DaemonManager } from './server/daemonManager';
import { isWaypaperDaemonRunning } from './utils/checkDependencies';
import { notify } from './utils/notifications';
import { configuration } from './config/config';
if (isWaypaperDaemonRunning()) {
    console.error('Another instance is already running');
    process.exit(2);
}
const scriptFlag = process.argv.find(arg => {
    return arg.includes('--script');
});
if (scriptFlag !== undefined) {
    const userScriptLocation = scriptFlag.split('=')[1];
    configuration.script = userScriptLocation;
}
process.title = 'wpe-daemon';
try {
    const daemonManager = new DaemonManager();
    process.on('SIGTERM', function () {
        notify('Exiting daemon');
        daemonManager.serverInstance.close();
        daemonManager.cleanUp();
        process.exit(0);
    });
    process.on('SIGINT', () => {
        notify('Exiting daemon');
        daemonManager.serverInstance.close();
        daemonManager.cleanUp();
        process.exit(0);
    });
} catch (error) {
    console.error(error);
    process.exit(1);
}
