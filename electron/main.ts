import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron'
import path from 'node:path'
import url from 'node:url'
import {
  copyImagesToCacheAndProcessThumbnails,
  setImage,
  isSwwwDaemonRunning,
  openAndReturnImagesObject,
  saveAndInitPlaylist,
  initWaypaperDaemon,
  PlaylistController
} from './appFunctions'
import { checkCacheOrCreateItIfNotExists } from './appFunctions'
import { testDB } from './database/db'
import { readImagesFromDB, readPlaylistsFromDB } from './database/dbOperations'
import { devMenu, prodMenu, trayMenu } from './globals/globals'
import { iconPath } from './binaries'

if (process.argv[1] === '--daemon-init') {
  isSwwwDaemonRunning().then(() => {
    initWaypaperDaemon().then(() => {
      app.exit()
    })
  })
}
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.exit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let tray: Tray | null = null
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

  if (VITE_DEV_SERVER_URL !== undefined) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    if (process.env.DIST) {
      win.loadFile(path.join(process.env.DIST, 'index.html'))
    } else {
      app.exit()
    }
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

app.whenReady().then(async () => {
  await checkCacheOrCreateItIfNotExists()
  await testDB()
  await isSwwwDaemonRunning()
  await initWaypaperDaemon()
})

app
  .whenReady()
  .then(() => {
    tray = new Tray(path.join(iconPath, 'tray.png'))
    const trayContextMenu = trayMenu({ win, app, PlaylistController })
    tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
    tray.setToolTip('Waypaper Manager')
    tray.on('click', () => {
      win?.isVisible() ? win.hide() : win?.show()
    })
  })
  .catch((e) => console.error(e))

ipcMain.handle('openFiles', openAndReturnImagesObject)
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails)
ipcMain.handle('queryImages', readImagesFromDB)
ipcMain.handle('queryPlaylists', readPlaylistsFromDB)
ipcMain.on('setImage', setImage)
ipcMain.on('saveAndStartPlaylist', saveAndInitPlaylist)
ipcMain.on('startPlaylist', (_event, playlistName: string) => {
  PlaylistController.startPlaylist(playlistName)
})
