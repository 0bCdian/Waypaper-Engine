import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyImagesToCacheAndProcessThumbnails,
  setImage,
  openAndReturnImagesObject,
  savePlaylist,
  PlaylistController,
  isSwwwDaemonRunning,
  initWaypaperDaemon,
  deleteImageFromGallery,
  remakeThumbnailsIfImagesExist
} from './appFunctions'
import dbOperations from './database/dbOperations'
import {
  devMenu,
  prodMenu,
  trayMenu,
  trayMenuWithControls
} from './globals/globals'
import { iconPath } from './binaries'
import installExtension, {
  REACT_DEVELOPER_TOOLS
} from 'electron-devtools-assembler'
import { swwwConfig } from './database/swwwConfig'
import { AppConfigDB } from '../src/routes/AppConfiguration'
import config from './database/globalConfig'
import {
  Image,
  PLAYLIST_TYPES,
  rendererPlaylist
} from '../src/types/rendererTypes'
if (process.argv[1] === '--daemon' || process.argv[3] === '--daemon') {
  initWaypaperDaemon()
  app.exit(1)
}
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.exit(1)
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
    backgroundColor: '#3C3836',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false
    }
  })
  if (VITE_DEV_SERVER_URL !== undefined) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    if (process.env.DIST) {
      console.log(process.env.DIST)
      win.loadFile(join(process.env.DIST, 'index.html'))
    } else {
      app.exit()
    }
  }
  win.once('ready-to-show', () => {
    if (config.app.config.startMinimized) {
      win?.hide()
    } else {
      win?.show()
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

function loadDeveloperTools() {
  const options = {
    loadExtensionOptions: { allowFileAccess: true }
  }
  installExtension(REACT_DEVELOPER_TOOLS, options)
    .then((name) => console.log(`Added Extension:  ${name}`))
    .catch((err) => console.log('An error occurred: ', err))
}

function createTray() {
  tray = new Tray(join(iconPath, 'tray.png'))
  const playlist = dbOperations.getCurrentPlaylist()
  let trayContextMenu = trayMenu({ app })
  if (playlist !== null) {
    if (
      playlist.type === PLAYLIST_TYPES.TIMER ||
      playlist.type === PLAYLIST_TYPES.NEVER
    ) {
      trayContextMenu = trayMenuWithControls({
        app,
        PlaylistController,
        win,
        tray,
        playlistType: playlist.type
      })
    }
  }
  tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
  tray.setToolTip('Waypaper Engine')
  tray.on('click', () => {
    win?.isVisible() ? win.hide() : win?.show()
  })
}

function updateTrayContextMenu() {
  if (tray) {
    const playlist = dbOperations.getCurrentPlaylist()
    let trayContextMenu = trayMenu({ app })
    if (playlist !== null) {
      if (
        playlist.type === PLAYLIST_TYPES.TIMER ||
        playlist.type === PLAYLIST_TYPES.NEVER
      ) {
        trayContextMenu = trayMenuWithControls({
          app,
          PlaylistController,
          win,
          tray,
          playlistType: playlist.type
        })
      }
    }
    tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
    tray.setToolTip('Waypaper Engine')
    tray.on('click', () => {
      win?.isVisible() ? win.hide() : win?.show()
    })
  }
}

app
  .whenReady()
  .then(async () => {
    createWindow()
    createMenu()
    createTray()
    registerFileProtocol()
    remakeThumbnailsIfImagesExist()
    await isSwwwDaemonRunning()
    await initWaypaperDaemon()
  })
  .catch((e) => console.error(e))

app.on('quit', () => {
  if (config.app.config.killDaemon) {
    PlaylistController.killDaemon()
  }
})

ipcMain.handle('openFiles', openAndReturnImagesObject)
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails)
ipcMain.handle('queryImages', () => {
  return dbOperations.readAllImagesInDB()
})
ipcMain.handle('queryPlaylists', () => {
  const playlists = dbOperations.readAllPlaylistsInDB()
  return playlists
})
ipcMain.handle('getPlaylistImages', (_event, playlistID: number) => {
  return dbOperations.getImagesInPlaylist(playlistID)
})
ipcMain.handle('readSwwwConfig', dbOperations.readSwwwConfig)
ipcMain.handle('readAppConfig', dbOperations.readAppConfig)
ipcMain.handle('deleteImageFromGallery', deleteImageFromGallery)
ipcMain.handle('readActivePlaylist', () => {
  const activePlaylist = dbOperations.getCurrentPlaylist()
  if (activePlaylist !== null) {
    const playlistImages = dbOperations.getImagesInPlaylist(activePlaylist.id)
    return { ...activePlaylist, images: playlistImages }
  } else {
    return undefined
  }
})
ipcMain.on('deletePlaylist', (_, playlistName: string) => {
  dbOperations.deletePlaylistInDB(playlistName)
  const current = dbOperations.getCurrentPlaylist()
  if (current !== null && current.name === playlistName) {
    PlaylistController.stopPlaylist()
  }
})
ipcMain.on('setImage', setImage)
ipcMain.on('savePlaylist', (_, playlistObject: rendererPlaylist) => {
  savePlaylist(playlistObject)
  dbOperations.setCurrentPlaylist(playlistObject.name)
  updateTrayContextMenu()
})
ipcMain.on('startPlaylist', (_event, playlistName: string) => {
  dbOperations.setCurrentPlaylist(playlistName)
  PlaylistController.startPlaylist()
  updateTrayContextMenu()
})
ipcMain.on('stopPlaylist', (_) => {
  PlaylistController.stopPlaylist()
  dbOperations.setActivePlaylistToNull()
  updateTrayContextMenu()
})
ipcMain.on('updateSwwwConfig', (_, newSwwwConfig: swwwConfig) => {
  dbOperations.updateSwwwConfig(newSwwwConfig)
  config.swww.update()
  PlaylistController.updateConfig()
})
ipcMain.on('openContextMenuImage', (event, image: Image) => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Set ${image.name}`,
      click: () => {
        setImage(event, image.name)
      }
    },
    {
      label: `Delete ${image.name}`,
      click: () => {
        const deleteFromGallery = window.confirm(
          `Are you sure you want to delete ${image.name} from the gallery?`
        )
        if (deleteFromGallery) {
          deleteImageFromGallery(event, image.id, image.name)
        }
      }
    }
  ])
  contextMenu.popup()
})
ipcMain.on('updateAppConfig', (_, newAppConfig: AppConfigDB) => {
  dbOperations.updateAppConfig(newAppConfig)
  config.app.update()
  PlaylistController.updateConfig()
})
ipcMain.on('updateTray', () => {
  updateTrayContextMenu()
})
ipcMain.on('exitApp', () => {
  app.exit()
})
