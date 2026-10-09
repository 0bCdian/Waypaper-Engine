# Changelog

User-facing changes, newest first. Downloads are on [GitHub Releases](https://github.com/0bCdian/Waypaper-Engine/releases).

## Unreleased

- Breaking for scripts: `waypaper-daemon playlist start` takes `--monitors` and `--extend` instead of `--monitor` and `--mode`, and `POST /playlists/{id}/start` takes `{monitors, extend}`. See the [CLI](/reference/cli) and [API](/reference/api) references.
- Playlists remember the monitors you asked for, so booting once with a monitor asleep no longer pins the playlist to the rest.
- Fixed a playlist timer bug that could briefly blank an output about 30 seconds after a change.

## 3.1.1 (2026-07-26)

- Fixed the wal-qt wallpaper missing after a cold boot.
- Fixed the monitor modal showing no thumbnail on a fresh start with auto backend selection.
- Fixed playlists restoring wrongly after a restart or resume: paused playlists starting unpaused, missed changes, and a wrong progress bar.
- The GUI resyncs with the daemon after suspend and after the event stream reconnects.
- The "Allow network for HTML wallpapers" setting now actually reaches wal-qt.
- Fixed a daemon panic when switching backends with none active.

## 3.1.0 (2026-07-12)

- New hue filter strip in the gallery: 12 hue swatches plus one for neutrals. Click to filter, click again to clear.
- New Rainbow sort, ordering by hue with neutrals last.
- New colour picker that adds a `near:#hex~25` token to the search bar.
- The Choose Display preview now fits any monitor arrangement, with larger monitor miniatures.

## 3.0.0 (2026-05-22)

A rewrite, not a drop-in upgrade from v2: your v2 gallery and playlists are not migrated. See [Coming from v2](/manual/troubleshooting#coming-from-v2).

- A Go daemon replaces the Node backend and keeps playlists running when you close the window.
- New `waypaper-daemon` CLI and an HTTP API with live events. See the [CLI](/reference/cli), [API](/reference/api) and [events](/reference/events) references.
- Backends: awww, hyprpaper, swaybg, feh, mpvpaper and wal-qt, plus an auto mode that picks one per media type. See [Backends](/manual/backends).
- HTML wallpapers through wal-qt. See [HTML wallpapers](/manual/html-wallpapers).
- Loop Studio and Shader Studio (beta). See [Studios](/manual/studios).
- Per-monitor wallpaper previews in the monitor modal.
- New UI: drawer layout, font presets, more themes, UI scale. See [Themes](/manual/themes).
- Better Wallhaven browsing. See [Wallhaven](/manual/wallhaven).
- Data moved to `~/.local/share/waypaper-engine/`.
- Playlist type `never` is now `manual`, and the per-playlist "show animations" toggle is gone.
- `swww` is now `awww`.
- The v2 `scripts` folder is gone; use `waypaper-daemon events`. See [Scripting & hooks](/manual/scripting).

## 2.x (2024 to 2025)

- 2.0.4 (2025-02-03): dependency fixes.
- 2.0.3, 2.0.2 (2024-05): small fixes; 2.0.2 started publishing an AppImage.
- 2.0.1 (2024-05-07): fixed a first-boot database crash and images missing from the gallery on first boot.
- 2.0.0 (2024-05-06): per-monitor playlists, faster stretched wallpapers, playlist control from the CLI, multi-select, a history of the last 10 images, and a `scripts` folder run on every image set.

## 1.x (2023 to 2024)

Releases 1.2.0 to 1.2.8 were the original app. See the [GitHub releases](https://github.com/0bCdian/Waypaper-Engine/releases).
