import { homedir } from 'node:os'
import { join } from 'node:path'
import { type BrowserWindow, type App, Menu, Tray } from 'electron'
import { PlaylistControllerType } from '../types/types'
const systemHome = homedir()
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper_engine')
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails')
const mainDirectory = join(systemHome, '.waypaper_engine')
const imagesDir = join(mainDirectory, 'images')

export const appDirectories = {
  systemHome: systemHome,
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir
}
export const WAYPAPER_ENGINE_SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock'

export const validImageExtensions = [
  'jpeg',
  'jpg',
  'png',
  'gif',
  'bmp',
  'webp',
  'pnm',
  'tga',
  'tiff',
  'farbfeld'
]

export const devMenu = ({
  win,
  app
}: {
  win: BrowserWindow | null
  app: App
}) => {
  const devMenu = [
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
    },
    {
      label: 'Reload',
      accelerator: (function () {
        if (process.platform == 'darwin') return 'Command+R'
        else return 'Ctrl+R'
      })(),
      click: function () {
        if (win?.isFocused()) win.reload()
      }
    }
  ]
  return devMenu
}

export const prodMenu = ({ app }: { app: App }) => {
  const devMenu = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          click: () => app.exit()
        }
      ]
    }
  ]
  return devMenu
}

export const trayMenuWithControls = ({
  app,
  PlaylistController,
  win,
  tray
}: {
  app: App
  PlaylistController: PlaylistControllerType
  win: BrowserWindow | null
  tray: Tray | null
}) => {
  const controls = [
    {
      label: 'Next Wallpaper',
      click: () => {
        PlaylistController.nextImage()
      }
    },
    {
      label: 'Previous Wallpaper',
      click: () => {
        PlaylistController.previousImage()
      }
    },
    {
      label: 'Stop Playlist',
      click: () => {
        PlaylistController.stopPlaylist()
        win?.webContents.send('clearPlaylist')
        const menu = Menu.buildFromTemplate([
          {
            label: 'Quit',
            click: () => app.exit()
          }
        ])
        tray?.setContextMenu(menu)
      }
    },
    {
      label: 'Quit',
      click: () => app.exit()
    }
  ]
  return controls
}

export const trayMenu = ({ app }: { app: App }) => {
  const controls = [
    {
      label: 'Quit',
      click: () => app.exit()
    }
  ]
  return controls
}

export const contextMenu = [
  {
    label: 'Set image',
    click: (e: any) => {
      console.log(e)
    }
  }
]
