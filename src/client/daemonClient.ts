// daemonClient is the single seam between React and the Electron preload.
// All stores and hooks call this module — never window.API_RENDERER.goDaemon directly.
// Initialized at module load time (desktop app, no lazy loading needed).

type GoDaemon = Window["API_RENDERER"]["goDaemon"];

function gd(): GoDaemon {
  return window.API_RENDERER.goDaemon;
}

export const daemonClient = {
  // HEALTH & SYSTEM
  ping: () => gd().ping(),
  getInfo: () => gd().getInfo(),
  getCapabilities: () => gd().getCapabilities(),
  shutdown: () => gd().shutdown(),

  // IMAGES
  getImages: (...args: Parameters<GoDaemon["getImages"]>) => gd().getImages(...args),
  getImage: (id: number) => gd().getImage(id),
  ensureBrowserPreview: (...args: Parameters<GoDaemon["ensureBrowserPreview"]>) =>
    gd().ensureBrowserPreview(...args),
  videoLoopExport: (...args: Parameters<GoDaemon["videoLoopExport"]>) =>
    gd().videoLoopExport(...args),
  extractVideoPalette: (...args: Parameters<GoDaemon["extractVideoPalette"]>) =>
    gd().extractVideoPalette(...args),
  importImages: (...args: Parameters<GoDaemon["importImages"]>) => gd().importImages(...args),
  importWebWallpaper: (...args: Parameters<GoDaemon["importWebWallpaper"]>) =>
    gd().importWebWallpaper(...args),
  cancelImport: (batchID: string) => gd().cancelImport(batchID),
  deleteImages: (ids: number[]) => gd().deleteImages(ids),
  updateImage: (...args: Parameters<GoDaemon["updateImage"]>) => gd().updateImage(...args),
  selectAllImages: (selected: boolean) => gd().selectAllImages(selected),
  getImageTags: () => gd().getImageTags(),
  getImageHistory: (...args: Parameters<GoDaemon["getImageHistory"]>) =>
    gd().getImageHistory(...args),
  clearImageHistory: () => gd().clearImageHistory(),

  // WALLPAPER
  getCurrentWallpapers: () => gd().getCurrentWallpapers(),
  setWallpaper: (...args: Parameters<GoDaemon["setWallpaper"]>) => gd().setWallpaper(...args),
  setRandomWallpaper: (...args: Parameters<GoDaemon["setRandomWallpaper"]>) =>
    gd().setRandomWallpaper(...args),

  // PLAYLISTS
  getPlaylists: () => gd().getPlaylists(),
  getPlaylist: (id: number) => gd().getPlaylist(id),
  createPlaylist: (...args: Parameters<GoDaemon["createPlaylist"]>) => gd().createPlaylist(...args),
  updatePlaylist: (...args: Parameters<GoDaemon["updatePlaylist"]>) => gd().updatePlaylist(...args),
  deletePlaylist: (id: number) => gd().deletePlaylist(id),
  startPlaylist: (...args: Parameters<GoDaemon["startPlaylist"]>) => gd().startPlaylist(...args),
  stopPlaylist: (id: number) => gd().stopPlaylist(id),
  pausePlaylist: (id: number) => gd().pausePlaylist(id),
  resumePlaylist: (id: number) => gd().resumePlaylist(id),
  nextPlaylistImage: (id: number) => gd().nextPlaylistImage(id),
  previousPlaylistImage: (id: number) => gd().previousPlaylistImage(id),
  getActivePlaylists: () => gd().getActivePlaylists(),
  getActivePlaylistForMonitor: (monitor: string) => gd().getActivePlaylistForMonitor(monitor),
  stopAllPlaylists: () => gd().stopAllPlaylists(),

  // FOLDERS
  getFolders: (...args: Parameters<GoDaemon["getFolders"]>) => gd().getFolders(...args),
  getFolder: (id: number) => gd().getFolder(id),
  getFolderPath: (id: number) => gd().getFolderPath(id),
  createFolder: (...args: Parameters<GoDaemon["createFolder"]>) => gd().createFolder(...args),
  updateFolder: (...args: Parameters<GoDaemon["updateFolder"]>) => gd().updateFolder(...args),
  deleteFolder: (...args: Parameters<GoDaemon["deleteFolder"]>) => gd().deleteFolder(...args),
  moveImagesToFolder: (...args: Parameters<GoDaemon["moveImagesToFolder"]>) =>
    gd().moveImagesToFolder(...args),

  // MONITORS
  getMonitors: () => gd().getMonitors(),
  getMonitor: (name: string) => gd().getMonitor(name),

  // CONFIG
  getConfig: () => gd().getConfig(),
  updateConfig: (...args: Parameters<GoDaemon["updateConfig"]>) => gd().updateConfig(...args),
  getConfigSection: (section: string) => gd().getConfigSection(section),
  updateConfigSection: (...args: Parameters<GoDaemon["updateConfigSection"]>) =>
    gd().updateConfigSection(...args),
  getBackendConfig: (name: string) => gd().getBackendConfig(name),
  updateBackendConfig: (...args: Parameters<GoDaemon["updateBackendConfig"]>) =>
    gd().updateBackendConfig(...args),

  // BACKENDS
  getBackends: () => gd().getBackends(),
  getBackendCapabilities: () => gd().getBackendCapabilities(),
  activateBackend: (name: string) => gd().activateBackend(name),

  // EVENT LISTENERS
  on: (...args: Parameters<GoDaemon["on"]>) => gd().on(...args),
} as const;

export type DaemonClient = typeof daemonClient;
