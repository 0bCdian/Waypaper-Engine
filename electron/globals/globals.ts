import { homedir } from 'node:os'
import { join } from 'node:path'
import { type BrowserWindow, type App, Menu } from 'electron'
import { PlaylistControllerType, Playlist } from '../types/types'
import { PLAYLIST_TYPES } from '../../src/types/rendererTypes'
const systemHome = homedir()
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper_engine')
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails')
const mainDirectory = join(systemHome, '.waypaper_engine')
const imagesDir = join(mainDirectory, 'images')
const tempImages = join(mainDirectory, 'tempImages')

export const appDirectories = {
  systemHome: systemHome,
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir,
  tempImages: tempImages
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
  const prodMenu = [
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
  return prodMenu
}

export const trayMenu = (
  app: App,
  PlaylistController: PlaylistControllerType
) => {
  const controlsMenu = Menu.buildFromTemplate([
    {
      type: 'separator'
    },
    {
      label: 'Random Wallpaper',
      click: () => {
        PlaylistController.randomImage()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.exit()
      }
    }
  ])
  return controlsMenu
}

export const trayMenuWithControls = ({
  PlaylistController,
  win,
  app,
  playlist
}: {
  PlaylistController: PlaylistControllerType
  win: BrowserWindow | null
  app: App
  playlist: Playlist
  playlistList: Playlist[]
}) => {
  const menuWithControls = Menu.buildFromTemplate([
    {
      label: 'Next Wallpaper',
      enabled:
        playlist.type === PLAYLIST_TYPES.TIMER ||
        playlist.type === PLAYLIST_TYPES.NEVER,
      click: () => {
        PlaylistController.nextImage()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Previous Wallpaper',
      enabled:
        playlist.type === PLAYLIST_TYPES.TIMER ||
        playlist.type === PLAYLIST_TYPES.NEVER,
      click: () => {
        PlaylistController.previousImage()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Random Wallpaper',
      click: () => {
        PlaylistController.randomImage()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Pause Playlist',
      enabled: playlist.type === PLAYLIST_TYPES.TIMER,
      click: () => {
        PlaylistController.pausePlaylist()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Stop Playlist',
      click: () => {
        PlaylistController.stopPlaylist()
        win?.webContents.send('clearPlaylist')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.exit()
      }
    }
  ])

  return menuWithControls
}

export const contextMenu = [
  {
    label: 'Set image',
    click: (e: any) => {
      console.log(e)
    }
  }
]
