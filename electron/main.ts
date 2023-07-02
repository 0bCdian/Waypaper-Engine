import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import path from 'node:path'
import url from 'url'
import {
  openAndValidateImages,
  copyImagesToCacheAndProcessThumbnails
} from './appFunctions'
import { checkCacheOrCreateItIfNotExists } from './appFunctions'
import { testDB } from './database/db'
import { readImagesFromDB } from './database/dbOperations'

process.env.DIST = path.join(__dirname, '../dist-electron')
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createWindow() {
  win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  win = null
})

app.whenReady().then(createWindow)

app.whenReady().then(() => {
  protocol.registerFileProtocol('atom', (request, callback) => {
    const filePath = url.fileURLToPath(
      'file://' + request.url.slice('atom://'.length)
    )
    callback(filePath)
  })
})

app.whenReady().then(() => {
  checkCacheOrCreateItIfNotExists()
  testDB()
})

ipcMain.handle('openFiles', openAndValidateImages)
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails)
ipcMain.handle('queryImages', readImagesFromDB)
