import path from 'path'
import { app } from 'electron'
import process from 'node:process'

const binariesPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './bin')
  : path.join(process.cwd(), '/electron/bin')
const childPathFile = app.isPackaged
  ? path.join(
      path.dirname(app.getAppPath()),
      '..',
      './resources',
      './bin/daemon.js'
    )
  : path.join(process.cwd(), '/daemon/daemon.js')
const iconsPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './icons')
  : path.join(process.cwd(), '/electron/icons')
export const execPath = path.resolve(path.join(binariesPath))
export const iconPath = path.resolve(path.join(iconsPath))
export const childPath = path.resolve(path.join(childPathFile))
