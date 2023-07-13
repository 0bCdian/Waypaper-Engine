import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron'
import path from 'node:path'
import url from 'url'
import {
  openAndValidateImages,
  copyImagesToCacheAndProcessThumbnails,
  setImage,
  isDaemonRunning
} from './appFunctions'
import { checkCacheOrCreateItIfNotExists } from './appFunctions'
import { testDB } from './database/db'
import { readImagesFromDB } from './database/dbOperations'
import { appDirectories } from './globals/globals'

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let tray = null
let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.PUBLIC, 'electron-vite.svg'),
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
  win.once('ready-to-show', () => {
    win?.show()
  })
  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })
}
const menu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Quit',
        click: () => app.exit()
      }
    ]
  },
  {
    label: 'Toggle Developer Tools',
    accelerator: (function () {
      if (process.platform == 'darwin') return 'Alt+Command+I'
      else return 'Ctrl+Shift+I'
    })(),
    click: function () {
      if (win?.isFocused()) win.webContents.toggleDevTools()
    }
  }
]

const mainMenu = Menu.buildFromTemplate(menu)

app.whenReady().then(() => {
  createWindow()
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
  isDaemonRunning()
})

app
  .whenReady()
  .then(() => {
    tray = new Tray(`/home/obsy/Pictures/wallpaper.png`)
    tray.setToolTip('Waypaper Manager')
    tray.on('click', () => {
      win?.isVisible() ? win.hide() : win?.show()
    })
  })
  .catch((e) => console.error(e))

ipcMain.handle('openFiles', openAndValidateImages)
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails)
ipcMain.handle('queryImages', readImagesFromDB)
ipcMain.on('setImage', setImage)
