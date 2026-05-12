import { vi } from "vitest";

function cloneConfig<T>(cfg: T): T {
  return JSON.parse(JSON.stringify(cfg)) as T;
}

export function createMockAPI(): Window["API_RENDERER"] {
  const baselineUnifiedConfig = {
    app: {
      kill_daemon_on_exit: false,
      notifications: true,
      start_minimized: false,
      minimize_instead_of_close: false,
      show_monitor_modal_on_start: true,
      startup_intro: true,
      images_per_page: 50,
      theme: "kolision-raw" as const,
      font_preset: "bundled",
      font_family_body: "",
      font_family_display: "",
      font_family_mono: "",
      image_history_limit: 1000,
      sort_by: "imported_at" as const,
      sort_order: "desc" as const,
    },
    daemon: {
      images_dir: "/tmp/images",
      thumbnails_dir: "/tmp/thumbs",
      database_dir: "/tmp/db",
      socket_path: "/tmp/waypaper.sock",
      log_level: "info" as const,
      log_file: "/tmp/daemon.log",
      log_max_size_mb: 10,
      log_max_backups: 3,
      compositor: "auto" as const,
    },
    backend: { type: "awww" },
    monitors: {
      selected_monitors: [] as string[],
      image_set_type: "individual" as const,
    },
    wallhaven: {
      api_key: "",
      enabled: false,
      scroll_mode: "paginated" as const,
    },
  };

  let liveUnifiedConfig = cloneConfig(baselineUnifiedConfig);

  return {
    goDaemon: {
      ping: vi.fn().mockResolvedValue(true),
      getInfo: vi.fn().mockResolvedValue({
        version: "3.0.0",
        pid: 1234,
        hostname: "test",
        uptime: "1h0m0s",
        go_version: "go1.26",
        os: "linux",
        arch: "amd64",
      }),
      getCapabilities: vi.fn().mockResolvedValue({ ffmpeg_available: true }),
      shutdown: vi.fn().mockResolvedValue(undefined),

      getImages: vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          per_page: 50,
          total_items: 0,
          total_pages: 0,
        },
      }),
      getImage: vi.fn().mockResolvedValue(null),
      ensureBrowserPreview: vi.fn().mockResolvedValue(null),
      videoLoopExport: vi.fn().mockResolvedValue({
        action: "import_new",
        image_id: 1,
        path: "atom://tmp/x.webm",
      }),
      extractVideoPalette: vi.fn().mockResolvedValue({
        colors: ["#112233", "#445566"],
        image_id: 1,
        image: { id: 1, name: "mock", path: "/tmp/x.mp4", colors: ["#112233", "#445566"] },
      }),
      importImages: vi.fn().mockResolvedValue({ status: "processing", total: 0 }),
      importWebWallpaper: vi.fn().mockResolvedValue(null),
      cancelImport: vi.fn().mockResolvedValue({ status: "cancelled", batch_id: "" }),
      deleteImages: vi.fn().mockResolvedValue({ deleted: 0 }),
      updateImage: vi.fn().mockResolvedValue(null),
      selectAllImages: vi.fn().mockResolvedValue({ updated: 0, selected: false }),
      getImageTags: vi.fn().mockResolvedValue({ tags: [] }),
      getImageHistory: vi.fn().mockResolvedValue([]),
      clearImageHistory: vi.fn().mockResolvedValue({ status: "cleared" }),

      getCurrentWallpapers: vi.fn().mockResolvedValue({
        backend: "",
        image_id: 0,
        image_name: "",
        image_path: "",
        mode: "",
        monitors: [],
      }),
      setWallpaper: vi.fn().mockResolvedValue({
        status: "set",
        image_id: 0,
        monitor: "",
        mode: "individual",
      }),
      setRandomWallpaper: vi.fn().mockResolvedValue({
        status: "set",
        image_id: 0,
        monitor: "",
        mode: "individual",
      }),

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

      getFolders: vi.fn().mockResolvedValue({ data: [] }),
      getFolder: vi.fn().mockResolvedValue(null),
      getFolderPath: vi.fn().mockResolvedValue({ data: [] }),
      createFolder: vi.fn().mockResolvedValue(null),
      updateFolder: vi.fn().mockResolvedValue(null),
      deleteFolder: vi.fn().mockResolvedValue({ deleted: true, mode: "keep_contents" }),
      moveImagesToFolder: vi.fn().mockResolvedValue({ moved: 0 }),

      getMonitors: vi.fn().mockResolvedValue([]),
      getMonitor: vi.fn().mockResolvedValue(null),

      getConfig: vi.fn().mockImplementation(async () => cloneConfig(liveUnifiedConfig)),
      updateConfig: vi.fn().mockResolvedValue(null),
      getConfigSection: vi.fn().mockResolvedValue({}),
      updateConfigSection: vi
        .fn()
        .mockImplementation(
          async (section: keyof typeof baselineUnifiedConfig, data: Record<string, unknown>) => {
            const prev = liveUnifiedConfig[section] as Record<string, unknown>;
            liveUnifiedConfig = {
              ...liveUnifiedConfig,
              [section]:
                typeof prev === "object" && prev !== null && !Array.isArray(prev)
                  ? { ...prev, ...data }
                  : ({ ...data } as typeof prev),
            };
            return liveUnifiedConfig[section];
          },
        ),
      getBackendConfig: vi.fn().mockImplementation((_name: string) => Promise.resolve({})),
      updateBackendConfig: vi.fn().mockResolvedValue(undefined),
      resetAllConfig: vi.fn().mockImplementation(async () => cloneConfig(liveUnifiedConfig)),
      resetBackendConfig: vi.fn().mockResolvedValue({ status: "reset" }),

      getBackends: vi.fn().mockResolvedValue([
        {
          name: "awww",
          available: true,
          capabilities: {
            compositors: ["wayland"],
            media_types: ["image"],
            transitions: true,
            per_monitor: true,
            daemon_process: false,
          },
        },
      ]),
      getBackendCapabilities: vi.fn().mockResolvedValue(null),
      activateBackend: vi.fn().mockResolvedValue({ status: "activated", backend: "" }),

      on: vi.fn().mockReturnValue(() => {}),
    },

    getNativeTheme: vi.fn().mockResolvedValue({ shouldUseDarkColors: true }),
    setThemeSource: vi.fn().mockResolvedValue(undefined),
    onNativeThemeUpdated: vi.fn(),
    onThemeChanged: vi.fn(),

    getAppInfo: vi.fn().mockResolvedValue({}),
    ping: vi.fn().mockResolvedValue(true),

    getWindowBounds: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 1280, height: 720 }),
    setWindowBounds: vi.fn().mockResolvedValue(undefined),
    minimizeWindow: vi.fn().mockResolvedValue(undefined),
    maximizeWindow: vi.fn().mockResolvedValue(undefined),
    closeWindow: vi.fn().mockResolvedValue(undefined),
    hideWindow: vi.fn().mockResolvedValue(undefined),
    showWindow: vi.fn().mockResolvedValue(undefined),

    exitApp: vi.fn().mockResolvedValue(undefined),

    getDaemonStatus: vi.fn().mockResolvedValue({
      isRunning: true,
      lastChecked: Date.now(),
    }),
    restartDaemon: vi.fn().mockResolvedValue({ success: true }),
    startDaemon: vi.fn().mockResolvedValue({ success: true }),
    stopDaemon: vi.fn().mockResolvedValue({ success: true }),

    onAppError: vi.fn().mockReturnValue(() => {}),
    onDaemonStatusUpdate: vi.fn().mockReturnValue(() => {}),
    removeAllListeners: vi.fn(),

    wallhaven: {
      search: vi.fn().mockResolvedValue({}),
      getWallpaper: vi.fn().mockResolvedValue({}),
      testApiKey: vi.fn().mockResolvedValue({}),
      download: vi.fn().mockResolvedValue(""),
    },

    getPathForFile: vi.fn().mockReturnValue(""),
    downloadUrl: vi.fn().mockResolvedValue(""),
    openFiles: vi.fn().mockResolvedValue({ files: [], webRoots: [] }),
    writeShaderWebWallpaperPackage: vi.fn().mockResolvedValue({
      canceled: false,
      packageDir: "/tmp/waypaper-shader-test",
    }),
    scanDirectory: vi.fn().mockResolvedValue({ files: [], webRoots: [], folderName: "" }),
    handleOpenImages: vi.fn().mockResolvedValue({ message: "ok" }),
    revealInFileManager: vi.fn().mockResolvedValue(true),
    exportWallpapersToFolder: vi.fn().mockResolvedValue({
      canceled: false,
      destination: "/tmp/export-test",
      exported: 1,
      failed: 0,
    }),
    downloadYoutubeVideo: vi.fn().mockResolvedValue({ filePath: "/tmp/ytdl-test/video.mp4" }),

    logToMain: vi.fn(),
  };
}
