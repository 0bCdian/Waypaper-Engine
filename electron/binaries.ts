import { join, resolve } from 'node:path'
import { app } from 'electron'
import { resourcesPath } from 'node:process'

const iconsPath = app.isPackaged
  ? join(resourcesPath, './icons')
  : join(app.getAppPath(), '/electron/icons')
const daemon = app.isPackaged
  ? join(app.getAppPath(), '../', '/daemon')
  : join(app.getAppPath(), 'daemon')

export const iconPath = resolve(join(iconsPath))
export const daemonLocation = resolve(join(daemon))

console.log('daeemon', daemonLocation)

