import { execSync, spawn } from 'node:child_process';
import { notify } from './notifications';
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
        const output = spawn('swww-daemon &', {
            stdio: 'ignore',
            shell: true
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
