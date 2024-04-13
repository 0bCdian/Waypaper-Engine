import { DaemonManager } from './server/daemonManager';
import {
    isWaypaperDaemonRunning,
    initSwwwDaemon,
    parseArgs
} from './utils/checkDependencies';
import { notify } from './utils/notifications';
import { configuration } from './config/config';
import { writeFileSync } from 'node:fs';
if (isWaypaperDaemonRunning()) {
    console.error('Another instance is already running');
    process.exit(2);
}
parseArgs(process.argv, configuration);
initSwwwDaemon();
console.log(configuration);
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
    process.on('uncaughtException', (error, s) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        notify(`Daemon crashed, look up the logs. ${error}`);
        const stuff = {
            error,
            s
        };
        writeFileSync('/home/obsy/logs.txt', JSON.stringify(stuff));
        console.error(error);
        daemonManager.cleanUp();
        process.exit(0);
    });
} catch (error) {
    console.error(error);
    process.exit(1);
}
