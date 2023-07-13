import path from 'path'
import { app } from 'electron'

const { rootPath } = require('electron-root-path')
const binariesPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './bin')
  : path.join(rootPath, '/dist-electron/bin')
export const execPath = path.resolve(path.join(binariesPath))
console.log(execPath)
