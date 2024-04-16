import { DaemonManager } from './daemonManager';
import {
    isWaypaperDaemonRunning,
    initSwwwDaemon
} from '../globals/startDaemons';
import { notify } from '../utils/notifications';

if (isWaypaperDaemonRunning()) {
    console.warn('Another instance is already running');
    process.exit(2);
}
initSwwwDaemon();
process.title = 'wpe-daemon';
try {
    const daemonManager = new DaemonManager();
    process.on('SIGTERM', function () {
        notify('Exiting daemon');
        daemonManager.cleanUp();
        process.exit(0);
    });
    process.on('SIGINT', () => {
        notify('Exiting daemon');
        daemonManager.cleanUp();
        process.exit(0);
    });
    process.on('uncaughtException', error => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        notify(`Daemon crashed, ${error}`);
        console.error(error);
        daemonManager.cleanUp();
        process.exit(0);
    });
} catch (error) {
    console.error(error);
    process.exit(1);
}
