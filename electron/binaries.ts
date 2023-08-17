import { join, resolve } from 'node:path'
import { app } from 'electron'
import { resourcesPath } from 'node:process'

const iconsPath = app.isPackaged
  ? join(resourcesPath, './icons')
  : join(app.getAppPath(), '/electron/icons')
const daemon = app.isPackaged
  ? join(app.getAppPath(), '../', '/daemon')
  : join(app.getAppPath(), 'daemon')
const nativeBinding = app.isPackaged
  ? join(
      resourcesPath,
      '/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
    )
  : join(
      app.getAppPath(),
      '/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
    )
const dbPath = app.isPackaged
  ? join(app.getAppPath(), '../', '/waypaper.sqlite3')
  : join(app.getAppPath(), 'waypaper.sqlite3')

export const iconPath = resolve(join(iconsPath))
export const daemonLocation = resolve(join(daemon))
export const nativeBindingLocation = resolve(join(nativeBinding))
export const dbLocation = resolve(join(dbPath))
