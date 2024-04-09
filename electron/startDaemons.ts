import { execSync, spawn } from 'child_process';
import { daemonLocation } from './binaries';
import { configuration } from './database/globalConfig';

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
function isWaypaperDaemonRunning() {
    try {
        execSync('pidof wpe-daemon');
        return true;
    } catch (_err) {
        return false;
    }
}
export function initWaypaperDaemon() {
    if (!isWaypaperDaemonRunning()) {
        try {
            const args = [`${daemonLocation}/daemon.js &`];
            if (configuration.script !== undefined)
                args.push(`--script=${configuration.script}`);
            const output = spawn('node', args, {
                stdio: 'ignore',
                shell: true,
                detached: true,
                env: { ...process.env }
            });
            output.unref();
        } catch (error) {
            console.warn('Could not start wpe-daemon, shutting down app...');
            process.exit(1);
        }
    }
}
