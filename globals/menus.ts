import { type App, Menu, type Tray } from "electron";
import { goDaemonClient } from "../electron/goDaemonClient";
import type { ActivePlaylistInstance, ImageHistoryEntry } from "../electron/daemon-go-types";

function scheduleLockedActivePlaylist(ap: ActivePlaylistInstance): boolean {
  const t = ap.playlist_type;
  return t === "time_of_day" || t === "day_of_week";
}

async function safeCall(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (error) {
    console.error(`Failed to ${label}:`, error);
  }
}

export const trayMenu = async (app: App, trayInstance: Tray, createTray?: () => Promise<void>) => {
  let activePlaylists: ActivePlaylistInstance[] = [];
  let imageHistory: ImageHistoryEntry[] = [];

  try {
    activePlaylists = (await goDaemonClient.playlists.getActivePlaylists()) || [];
    imageHistory = (await goDaemonClient.images.getImageHistory(10)) || [];
  } catch (error) {
    console.error("Failed to fetch tray menu data:", error);
  }

  const playlistMenu: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem> =
    activePlaylists.length > 0
      ? [
          {
            label: "Active playlists",
            submenu: activePlaylists.map((playlist) => ({
              label: `${playlist.playlist_name} on: ${playlist.monitors.join(", ")}`,
              submenu: [
                ...(scheduleLockedActivePlaylist(playlist)
                  ? []
                  : ([
                      {
                        label: "Next image",
                        click: () => {
                          void safeCall(
                            () => goDaemonClient.playlists.nextPlaylistImage(playlist.playlist_id),
                            "get next image",
                          );
                          if (createTray) void createTray();
                        },
                      },
                      {
                        label: "Previous image",
                        click: () => {
                          void safeCall(
                            () =>
                              goDaemonClient.playlists.previousPlaylistImage(playlist.playlist_id),
                            "get previous image",
                          );
                          if (createTray) void createTray();
                        },
                      },
                    ] as Electron.MenuItemConstructorOptions[])),
                {
                  label: playlist.paused ? "Resume" : "Pause",
                  click: () => {
                    if (playlist.paused) {
                      void safeCall(
                        () => goDaemonClient.playlists.resumePlaylist(playlist.playlist_id),
                        "resume playlist",
                      );
                    } else {
                      void safeCall(
                        () => goDaemonClient.playlists.pausePlaylist(playlist.playlist_id),
                        "pause playlist",
                      );
                    }
                    if (createTray) void createTray();
                  },
                },
                {
                  label: "Stop",
                  click: () => {
                    void safeCall(
                      () => goDaemonClient.playlists.stopPlaylist(playlist.playlist_id),
                      "stop playlist",
                    );
                    if (createTray) void createTray();
                  },
                },
              ],
            })),
          },
        ]
      : [];

  const imageHistoryMenu: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem> =
    imageHistory.length > 0
      ? [
          {
            label: "Recent wallpapers",
            submenu: imageHistory.map((entry, index) => ({
              label: `${index + 1}. ${entry.image_name}`,
              click: async () => {
                try {
                  const monitor =
                    entry.mode === "extend" || entry.mode === "clone"
                      ? "*"
                      : (entry.monitors[0] ?? "*");
                  await goDaemonClient.wallpaper.setWallpaper(entry.image_id, monitor, entry.mode);
                } catch (error) {
                  console.error("Failed to set image from tray:", error);
                }
                void trayMenu(app, trayInstance).then((menu) => {
                  trayInstance.setContextMenu(menu);
                });
                if (createTray) void createTray();
              },
            })),
          },
        ]
      : [];

  const clearHistoryMenu: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem> =
    imageHistory.length > 0
      ? [
          {
            label: "Clear history",
            click: async () => {
              try {
                await goDaemonClient.images.clearImageHistory();
              } catch (error) {
                console.error("Failed to clear history:", error);
              }
              if (createTray) void createTray();
            },
          },
          { type: "separator" },
        ]
      : [];

  const baseMenu: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem> = [
    ...playlistMenu,
    ...imageHistoryMenu,
    ...clearHistoryMenu,
    {
      label: "Random Wallpaper",
      click: () => {
        void safeCall(() => goDaemonClient.wallpaper.setRandomWallpaper(), "set random wallpaper");
        if (createTray) void createTray();
      },
    },
    {
      label: "Quit",
      click: () => {
        app.exit();
      },
    },
  ];

  return Menu.buildFromTemplate(baseMenu);
};
