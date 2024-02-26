import { execSync } from 'node:child_process';
import { notify } from './notifications';
function checkIfSwwwIsInstalled() {
    try {
        execSync(`swww --version`, { encoding: 'utf-8' });
    } catch (error) {
        notify(
            `Swww is not installed or not in the path, please find instructions in the README.md on how to install it \n \n ${error as string}`
        );
        throw new Error(
            `swww is not installed, please find instructions in the README.md on how to install it  \n \n ${error as string}`
        );
    }
}

function isSwwwDaemonRunning() {
    checkIfSwwwIsInstalled();
    try {
        execSync(`ps -A | grep "swww-daemon"`, { encoding: 'utf-8' });
    } catch (error) {
        execSync('swww init', { shell: '/bin/sh' });
    }
}

export function isWaypaperDaemonRunning() {
    isSwwwDaemonRunning();
    try {
        const stdout = execSync('pidof wpe-daemon', { encoding: 'utf-8' });
        notify(`Waypaper Engine daemon already running,process pid: ${stdout}`);
        return true;
    } catch (_err) {
        return false;
    }
}
