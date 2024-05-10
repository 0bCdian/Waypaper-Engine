import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';
import pino, { type Logger } from 'pino';
const isPackaged = !(process.env.NODE_ENV === 'development');
export const isDaemon = process.env.PROCESS === 'daemon';
export const mainDirectory = join(homedir(), '.waypaper_engine');
if (!existsSync(mainDirectory)) {
    mkdirSync(mainDirectory);
}
const logPath = isDaemon
    ? join(mainDirectory, 'daemon.log')
    : join(mainDirectory, 'electron.log');
const parentLogger = pino(pino.destination(logPath));
const pinoLogger = parentLogger.child({
    module: isDaemon ? 'daemon' : 'electron'
});

const resourcesPath = join(__dirname, '..', '..');
export const iconsPath = resolve(
    isPackaged
        ? join(resourcesPath, './icons')
        : join(process.cwd(), 'build/icons')
);
export const daemonPath = resolve(
    isPackaged
        ? join(resourcesPath, 'daemon', 'dist', 'daemon')
        : join(process.cwd(), 'daemon', 'dist', 'daemon')
);

export const nativeBindingPath = resolve(
    isPackaged
        ? join(resourcesPath, 'better_sqlite3.node')
        : join(
              process.cwd(),
              '/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
          )
);

export const migrationsPath = resolve(
    isPackaged
        ? join(resourcesPath, 'migrations')
        : join(process.cwd(), '/database/migrations')
);

export const migrationsPathDaemon = resolve(
    isPackaged
        ? join(resourcesPath, '..', 'migrations')
        : join(process.cwd(), '..', '..', '..', '/database/migrations')
);
export const { values } = parseArgs({
    args: process.argv,
    options: {
        daemon: {
            type: 'boolean',
            short: 'd',
            default: false
        },
        format: {
            type: 'boolean',
            short: 'f',
            default: false
        },
        logs: {
            type: 'boolean',
            short: 'l',
            default: false
        }
    },
    strict: false
});

type customLogger = Console | Logger<never>;

export let logger: customLogger;

if (values.logs === true) {
    logger = pinoLogger;
} else {
    logger = console;
}
