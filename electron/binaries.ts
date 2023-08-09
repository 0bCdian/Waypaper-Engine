import { join, resolve } from 'node:path'
import { app } from 'electron'
import { cwd, resourcesPath } from 'node:process'

const iconsPath = app.isPackaged
  ? join(resourcesPath, './icons')
  : join(cwd(), '/electron/icons')
const appLocation = app.isPackaged
  ? app.getPath('exe')
  : cwd() + '/node_modules/electron/dist/electron'

export const iconPath = resolve(join(iconsPath))
export const appPath = resolve(join(appLocation))
