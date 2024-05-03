import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
const isPackaged = !(process.env.NODE_ENV === 'development');
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
        script: {
            short: 's',
            type: 'string',
            default: undefined
        }
    },
    strict: false
});
