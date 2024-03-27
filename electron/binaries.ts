import { join, resolve } from 'node:path';
import { app } from 'electron';
import { resourcesPath } from 'node:process';
import { appDirectories } from './globals/appPaths';

const iconsPath = app.isPackaged
    ? join(resourcesPath, './icons')
    : join(app.getAppPath(), 'build/icons');

const daemon = app.isPackaged
    ? join(app.getAppPath(), '../', '/daemon')
    : join(app.getAppPath(), 'daemon');

const nativeBinding = app.isPackaged
    ? join(resourcesPath, '/bin/better_sqlite3.node')
    : join(
          app.getAppPath(),
          '/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
      );

const dbPath = join(appDirectories.mainDir, 'images_database.sqlite3');
const migrationsPath = app.isPackaged
    ? join(app.getAppPath(), '')
    : join(app.getAppPath(), '/electron/database/migrations');

const binDirectory = app.isPackaged
    ? join(resourcesPath, 'bin')
    : join(app.getAppPath(), '/bin');

export const migrationPath = resolve(join(migrationsPath));
export const iconPath = resolve(join(iconsPath));
export const daemonLocation = resolve(join(daemon));
export const nativeBindingLocation = resolve(join(nativeBinding));
export const dbLocation = resolve(join(dbPath));
export const binDir = resolve(join(binDirectory));
