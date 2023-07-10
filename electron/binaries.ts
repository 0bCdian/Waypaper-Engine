import path from 'path'
import { app } from 'electron'

const { rootPath } = require('electron-root-path')

console.log(app.isPackaged)
const binariesPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './bin')
  : path.join(rootPath, '/dist-electron/bin')

console.log(binariesPath)
export const execPath = path.resolve(path.join(binariesPath))
