import path from 'path'
import { app } from 'electron'
import process from 'node:process'

const binariesPath = app.isPackaged
  ? path.join(path.dirname(app.getAppPath()), '..', './resources', './bin')
  : path.join(process.cwd(), '/electron/bin')
export const execPath = path.resolve(path.join(binariesPath))
