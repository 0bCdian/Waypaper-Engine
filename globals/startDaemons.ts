import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { daemonPath } from './setup';
import { configuration } from '../globals/config';
import { createConnection } from 'node:net';

const setTimeoutPromise = promisify(setTimeout);
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
        if (configuration.format) {
            execSync('killall swww-daemon');
        }
        execSync('ps -A | grep "swww-daemon"');
    } catch (error) {
        const command = `swww-daemon ${configuration.format ? '--format xrgb' : ''} &`;
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
        execSync('pidof wpe-daemon');
        return true;
    } catch (_err) {
        return false;
    }
}
export async function initWaypaperDaemon() {
    if (!isWaypaperDaemonRunning()) {
        try {
            const args = [`${daemonPath}/daemon.js`];
            if (configuration.format) {
                args.push(`--format`);
            }

            if (configuration.script !== undefined) {
                args.push(`--script ${configuration.script}`);
            }
            const output = spawn('PROCESS=daemon node', args, {
                stdio: 'ignore',
                shell: true,
                detached: true,
                env: { ...process.env }
            });
            output.unref();
            await testConnection();
        } catch (error) {
            console.error(error);
            console.warn('Could not start wpe-daemon, shutting down app...');
            process.exit(1);
        }
    }
}

async function testConnection() {
    const SOCKET_PATH = configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH;
    const MAX_ATTEMPTS = 10;
    const RETRY_INTERVAL = 200; // 200 milliseconds

    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
        try {
            await connectToDaemon(SOCKET_PATH);
            console.log('Connection to waypaper daemon established.');
            return; // Connection successful, exit loop
        } catch (error) {
            console.error(`Connection attempt ${attempt} failed:`, error);
            await setTimeoutPromise(RETRY_INTERVAL);
            attempt++;
        }
    }
    throw new Error('Failed to establish connection to waypaper daemon.');
}

async function connectToDaemon(socketPath: string) {
    return await new Promise((resolve, reject) => {
        try {
            const client = createConnection(socketPath, () => {
                // Connection successful
                client.end(); // Close the connection
                resolve('');
            });
            client.on('error', err => {
                // Connection failed
                reject(err);
            });
        } catch (error) {
            console.error(
                'failed to test connection, this is because createConnection trhowed'
            );
        }
    });
}
