import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyImagesToCacheAndProcessThumbnails,
  setImage,
  openAndReturnImagesObject,
  saveAndInitPlaylist,
  PlaylistController,
  isSwwwDaemonRunning,
  initWaypaperDaemon,
  checkCacheOrCreateItIfNotExists
} from './appFunctions'
import { testDB } from './database/db'
import { readImagesFromDB, readPlaylistsFromDB } from './database/dbOperations'
import { devMenu, prodMenu, trayMenu } from './globals/globals'
import { iconPath } from './binaries'
import { store } from './database/configStorage'
import installExtension, {
  REACT_DEVELOPER_TOOLS
} from 'electron-devtools-assembler'
if (process.argv[1] === '--daemon' || process.argv[3] === '--daemon') {
  initWaypaperDaemon()
  app.exit()
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
process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../public')

let tray: Tray | null = null
let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: join(iconPath, 'tray.png'),
    width: 1200,
    height: 600,
    minWidth: 940,
    minHeight: 560,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false
    }
  })

  if (VITE_DEV_SERVER_URL !== undefined) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    if (process.env.DIST) {
      win.loadFile(join(process.env.DIST, 'index.html'))
    } else {
      app.exit()
    }
  }
  win.once('ready-to-show', () => {
    if (store.get('startMinimized')) win?.show()
    else {
      win?.hide()
    }
  })
  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })
  win.webContents.once('dom-ready', () => {
    if (!app.isPackaged) loadDeveloperTools()
  })
}
function createMenu() {
  const menu = app.isPackaged ? prodMenu({ app }) : devMenu({ app, win })
  const mainMenu = Menu.buildFromTemplate(menu)
  Menu.setApplicationMenu(mainMenu)
}
function registerFileProtocol() {
  protocol.registerFileProtocol('atom', (request, callback) => {
    const filePath = fileURLToPath(
      'file://' + request.url.slice('atom://'.length)
    )
    callback(filePath)
  })
}
function createTray() {
  tray = new Tray(join(iconPath, 'tray.png'))
  const trayContextMenu = trayMenu({ app, PlaylistController })
  tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
  tray.setToolTip('Waypaper Manager')
  tray.on('click', () => {
    win?.isVisible() ? win.hide() : win?.show()
  })
}
function loadDeveloperTools() {
  const options = {
    loadExtensionOptions: { allowFileAccess: true }
  }
  installExtension(REACT_DEVELOPER_TOOLS, options)
    .then((name) => console.log(`Added Extension:  ${name}`))
    .catch((err) => console.log('An error occurred: ', err))
}
app
  .whenReady()
  .then(async () => {
    createWindow()
    createMenu()
    createTray()
    registerFileProtocol()
    await checkCacheOrCreateItIfNotExists()
    await testDB()
    await isSwwwDaemonRunning()
    await initWaypaperDaemon()
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
ipcMain.on('stopPlaylist', (_) => {
  PlaylistController.stopPlaylist()
})
