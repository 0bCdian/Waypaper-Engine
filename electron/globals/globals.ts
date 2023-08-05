import { homedir } from 'node:os'
import { join } from 'node:path'
import { type BrowserWindow, type App } from 'electron'
const systemHome = homedir()
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper')
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails')
const mainDirectory = join(systemHome, '.waypaper')
const imagesDir = join(mainDirectory, 'images')
const playlistsDir = join(mainDirectory, 'playlists')

export const appDirectories = {
  systemHome: systemHome,
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir,
  playlistsDir: playlistsDir
}

export const swwwDefaults = [
  '--transition-fps',
  '60',
  '--transition-duration',
  '1',
  '--transition-type',
  'wipe'
]
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
