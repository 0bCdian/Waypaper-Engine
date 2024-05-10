import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { daemonPath, logger } from './setup';
import { configuration } from '../globals/config';
import { createConnection, createServer } from 'node:net';
import { type message } from '../types/types';
import { unlinkSync } from 'node:fs';
import EventEmitter from 'node:events';

const setTimeoutPromise = promisify(setTimeout);
function checkIfSwwwIsInstalled() {
    try {
        execSync(`swww --version`);
        console.info('swww is installed in the system');
    } catch (error) {
        console.warn(
            'swww is not installed, please find instructions in the README.md on how to install it'
        );
        logger.error(error);
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
            if (configuration.logs) {
                args.push(`--logs`);
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
            logger.error(error);
            console.warn('Could not start wpe-daemon, shutting down app...');
            process.exit(1);
        }
    }
}

async function testConnection() {
    const SOCKET_PATH =
        configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH;
    const MAX_ATTEMPTS = 10;
    const RETRY_INTERVAL = 300; // 300 milliseconds

    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
        try {
            await connectToDaemon(SOCKET_PATH);
            console.log('Connection to waypaper daemon established.');
            return;
        } catch (error) {
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
            logger.error(error);
            logger.error(
                'failed to test connection, this is because createConnection trhew'
            );
        }
    });
}

export function createMainServer() {
    const emitter = new EventEmitter();
    const serverInstance = createServer(socket => {
        socket.on('data', buffer => {
            buffer
                .toString()
                .split('\n')
                .filter(message => message !== '')
                .forEach(message => {
                    try {
                        const parsedMessage: message = JSON.parse(message);
                        emitter.emit(parsedMessage.action);
                    } catch (error) {
                        logger.error(error);
                    }
                });
        });
        socket.on('error', err => {
            logger.error('Socket error:', err.message);
        });
    });
    serverInstance.on('error', err => {
        if (err.message.includes('EADDRINUSE')) {
            unlinkSync(configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH);
            serverInstance.listen(
                configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH
            );
        } else {
            logger.error(err);
            throw err;
        }
    });
    serverInstance.listen(
        configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH
    );
    return emitter;
}
