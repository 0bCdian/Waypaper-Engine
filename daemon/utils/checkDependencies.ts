import { execSync, spawn } from 'node:child_process';
import { notify } from './notifications';
import { configuration } from '../config/config';
function checkIfSwwwIsInstalled() {
    try {
        execSync(`swww --version`);
        console.info('swww is installed in the system');
    } catch (error) {
        console.warn(
            'swww is not installed, please find instructions in the README.md on how to install it'
        );
        console.error(error);
        throw new Error('swww is not installed');
    }
}
export function initSwwwDaemon() {
    checkIfSwwwIsInstalled();
    try {
        execSync('ps -A | grep "swww-daemon"');
        console.log('Swww daemon already running');
    } catch (error) {
        console.log('daemon not running, initiating swww...');
        console.log(configuration);
        const command = `swww-daemon --format ${configuration.swwwFormat} &`;
        const output = spawn(command, {
            stdio: 'ignore',
            shell: true,
            detached: true
        });
        output.unref();
    }
}

export function isWaypaperDaemonRunning() {
    try {
        const stdout = execSync('pidof wpe-daemon', { encoding: 'utf-8' });
        notify(`Waypaper Engine daemon already running,process pid: ${stdout}`);
        return true;
    } catch (_err) {
        return false;
    }
}

export function parseArgs<
    T extends { swwwFormat: string | undefined; script: string | undefined }
>(args: string[], configuration: T) {
    for (let idx = 0; idx < args.length; idx++) {
        const currentArg = args[idx];
        switch (currentArg) {
            case '--script':
                configuration.script = args[idx + 1];
                break;
            case '--format':
                configuration.swwwFormat = args[idx + 1];
                break;
            default:
                break;
        }
    }
}
