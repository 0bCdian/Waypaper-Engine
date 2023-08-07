import path from 'path'
import { app } from 'electron'
import process from 'node:process'

const binariesPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './bin')
  : path.join(process.cwd(), '/electron/bin')
const daemonPath = app.isPackaged
  ? path.join(
      path.dirname(app.getAppPath()),
      '..',
      './resources',
      './daemon/daemon.js'
    )
  : path.join(process.cwd(), '/daemon/daemon.js')
const iconsPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './icons')
  : path.join(process.cwd(), '/electron/icons')
export const execPath = path.resolve(path.join(binariesPath))
export const iconPath = path.resolve(path.join(iconsPath))
export const waypaperDaemonPath = path.resolve(path.join(daemonPath))
