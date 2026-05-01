import { vi } from "vitest";
import type { DaemonClient } from "@/client";

export const mockDaemonClient: DaemonClient = {
  // HEALTH & SYSTEM
  ping: vi.fn().mockResolvedValue(true),
  getInfo: vi.fn().mockResolvedValue({ version: "test", backend: "mock" }),
  getCapabilities: vi.fn().mockResolvedValue({ ffmpeg_available: false }),
  shutdown: vi.fn().mockResolvedValue(undefined),

  // IMAGES
  getImages: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, per_page: 50 }),
  getImage: vi.fn().mockResolvedValue(null),
  ensureBrowserPreview: vi.fn().mockResolvedValue(null),
  videoLoopExport: vi.fn().mockResolvedValue({ status: "ok" }),
  importImages: vi.fn().mockResolvedValue({ status: "ok", total: 0 }),
  importWebWallpaper: vi.fn().mockResolvedValue(null),
  cancelImport: vi.fn().mockResolvedValue({ status: "ok", batch_id: "" }),
  deleteImages: vi.fn().mockResolvedValue({ deleted: 0 }),
  updateImage: vi.fn().mockResolvedValue(null),
  selectAllImages: vi.fn().mockResolvedValue({ updated: 0, selected: false }),
  getImageTags: vi.fn().mockResolvedValue({ tags: [] }),
  getImageHistory: vi.fn().mockResolvedValue([]),
  clearImageHistory: vi.fn().mockResolvedValue({ status: "ok" }),

  // WALLPAPER
  getCurrentWallpapers: vi.fn().mockResolvedValue({}),
  setWallpaper: vi
    .fn()
    .mockResolvedValue({ status: "ok", image_id: 0, monitor: "*", mode: "individual" }),
  setRandomWallpaper: vi
    .fn()
    .mockResolvedValue({ status: "ok", image_id: 0, monitor: "*", mode: "individual" }),

  // PLAYLISTS
  getPlaylists: vi.fn().mockResolvedValue([]),
  getPlaylist: vi.fn().mockResolvedValue(null),
  createPlaylist: vi.fn().mockResolvedValue(null),
  updatePlaylist: vi.fn().mockResolvedValue(null),
  deletePlaylist: vi.fn().mockResolvedValue(undefined),
  startPlaylist: vi.fn().mockResolvedValue(undefined),
  stopPlaylist: vi.fn().mockResolvedValue(undefined),
  pausePlaylist: vi.fn().mockResolvedValue(undefined),
  resumePlaylist: vi.fn().mockResolvedValue(undefined),
  nextPlaylistImage: vi.fn().mockResolvedValue(undefined),
  previousPlaylistImage: vi.fn().mockResolvedValue(undefined),
  getActivePlaylists: vi.fn().mockResolvedValue([]),
  getActivePlaylistForMonitor: vi.fn().mockResolvedValue(null),
  stopAllPlaylists: vi.fn().mockResolvedValue(undefined),

  // FOLDERS
  getFolders: vi.fn().mockResolvedValue({ data: [] }),
  getFolder: vi.fn().mockResolvedValue(null),
  getFolderPath: vi.fn().mockResolvedValue({ data: [] }),
  createFolder: vi.fn().mockResolvedValue(null),
  updateFolder: vi.fn().mockResolvedValue(null),
  deleteFolder: vi.fn().mockResolvedValue({ deleted: false, mode: "keep_contents" }),
  moveImagesToFolder: vi.fn().mockResolvedValue({ moved: 0 }),

  // MONITORS
  getMonitors: vi.fn().mockResolvedValue([]),
  getMonitor: vi.fn().mockResolvedValue(null),

  // CONFIG
  getConfig: vi.fn().mockResolvedValue({}),
  updateConfig: vi.fn().mockResolvedValue({}),
  getConfigSection: vi.fn().mockResolvedValue({}),
  updateConfigSection: vi.fn().mockResolvedValue({}),
  getBackendConfig: vi.fn().mockResolvedValue({}),
  updateBackendConfig: vi.fn().mockResolvedValue(undefined),

  // BACKENDS
  getBackends: vi.fn().mockResolvedValue([]),
  getBackendCapabilities: vi.fn().mockResolvedValue(null),
  activateBackend: vi.fn().mockResolvedValue({ status: "ok", backend: "mock" }),

  // EVENT LISTENERS
  on: vi.fn().mockReturnValue(() => {}),
};
