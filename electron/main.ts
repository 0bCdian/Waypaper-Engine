import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron'
import path from 'node:path'
import url from 'node:url'
import {
  copyImagesToCacheAndProcessThumbnails,
  setImage,
  isDaemonRunning,
  openAndReturnImagesObject,
  setBinInPath,
  saveAndInitPlaylist
} from './appFunctions'
import { checkCacheOrCreateItIfNotExists } from './appFunctions'
import { testDB } from './database/db'
import { readImagesFromDB } from './database/dbOperations'
import { devMenu, prodMenu } from './globals/globals'
import { iconPath } from './binaries'

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')
if (process.argv[1] === '--daemon') {
  console.log('daemon')
  isDaemonRunning()
  app.exit()
}
let tray = null
let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(iconPath, 'tray.png'),
    width: 1200,
    height: 600,
    minWidth: 940,
    minHeight: 560,
    frame: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#202020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
  win.once('ready-to-show', () => {
    win?.show()
  })
  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })
}

app.whenReady().then(() => {
  createWindow()
  const menu = app.isPackaged ? prodMenu({ app }) : devMenu({ app, win })
  const mainMenu = Menu.buildFromTemplate(menu)
  Menu.setApplicationMenu(mainMenu)
})

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
  setBinInPath()
  isDaemonRunning()
})

app
  .whenReady()
  .then(() => {
    tray = new Tray(path.join(iconPath, 'tray.png'))
    tray.setToolTip('Waypaper Manager')
    tray.on('click', () => {
      win?.isVisible() ? win.hide() : win?.show()
    })
  })
  .catch((e) => console.error(e))
ipcMain.handle('openFiles', openAndReturnImagesObject)
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails)
ipcMain.handle('queryImages', readImagesFromDB)
ipcMain.on('setImage', setImage)
ipcMain.on('savePlaylist', saveAndInitPlaylist)
