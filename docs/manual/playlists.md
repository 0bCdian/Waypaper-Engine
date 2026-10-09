# Playlists

A playlist is an ordered strip of wallpapers plus a rule for when to change. The daemon keeps it rotating even after you close the window.

## Build one

The strip lives in the bottom dock. Drag images or folders in from the gallery, or use **Add images** for files, a media directory, videos or web wallpapers. Drag cards to reorder.

1. Select your displays with **Select Display** in the top bar ([Displays & monitors](/manual/displays)).
2. Add more than one image to the strip.
3. Click **Configure** to set the type, interval and order.
4. Click **Save**. It writes the playlist and (re)starts it on the selected displays. It shows `Save*` when you have unsaved changes.

| Button | What it does |
| --- | --- |
| **Load Playlist** | Replaces the strip with a saved playlist and starts it right away on the selected displays. |
| **Random Image** | Sets one random wallpaper on the selected displays. |
| **Clear** | Stops the playlist and empties the strip. |

::: warning Pick your displays first
Save and Load refuse to run with no display selected.
:::

Saving a running playlist reloads it. A timer playlist keeps its current wallpaper; the other types restart.

## Pick a type

| Type (`type`) | Changes when | Needs | Next / Previous |
| --- | --- | --- | --- |
| **On a timer** (`timer`) | Every N seconds (the UI asks for hours and minutes) | An interval | Yes |
| **Time of day** (`time_of_day`) | At the clock times you assign to each image | A time on every image | No |
| **Day of week** (`day_of_week`) | At midnight, picking the image for that weekday | 7 images or fewer | No |
| **Manual** (`manual`) | Only when you say so | Nothing | Yes |

- **Timer:** zero hours and zero minutes snaps to one minute. The CLI `--interval` is in seconds. The countdown restarts when you start, resume or skip. **Order** is *Ordered* (strip order, wrapping) or *Random* (one shuffled pass through every image, then again).
- **Time of day:** each image shows from its time until the next image's time. Two images can't share a time. On start it jumps to the slot for *now*; before your first slot, the last slot (yesterday's) is still showing.
- **Day of week:** the first image is Sunday, the second Monday, through Saturday. With fewer than seven images, later days reuse the last one.
- **Manual:** nothing happens until you press next/previous or start another playlist. Good for a keybind.

**Always start on the first image** (timer and manual) makes every start you trigger begin at image 1 instead of resuming.

If the active backend can't show an entry (a video on `awww`, say), the playlist skips to the next one it can. See [Backends & dependencies](/manual/backends).

## Control it

Once a playlist is running, a controller appears with the playlist name, the current image and its monitors.

| UI action | CLI command | Notes |
| --- | --- | --- |
| Start | `waypaper-daemon playlist start -N "Evening" -m DP-1,HDMI-A-1` | No `-m` means all monitors. `--extend` stretches one image across them. |
| Pause / Resume | `playlist pause 3` / `playlist resume 3` | Pause freezes the timer. Resume restarts the interval from zero. |
| Next / Previous | `playlist next 3` / `playlist prev 3` | On a timer playlist this also restarts the countdown. Refused on time-of-day and day-of-week. Steps in strip order, even when shuffled. |
| Stop | `playlist stop 3` | |
| (none) | `playlist list`, `playlist active` | All saved playlists / what is running now. |

Every command takes a playlist ID, or `-N <name>` (case-insensitive). `stop-all`, `pause-all`, `resume-all`, `next-all` and `prev-all` act on everything running. There are also `get`, `create`, `update`, `delete`, and `pl` is an alias for `playlist`. Full flags in the [CLI reference](/reference/cli).

```sh
waypaper-daemon playlist create "Night" --type timer --interval 1800 --order random
```

::: tip Keybinds
`waypaper-daemon playlist next-all` on a key skips around. It errors only if every running playlist is clock-driven.
:::

## One playlist per monitor

A monitor can run only one playlist. For per-monitor playlists, start A on `DP-1` and B on `HDMI-A-1`. Starting a playlist on a monitor that already has one stops that other playlist entirely, even on its other monitors. For one playlist on two monitors, start it on both at once (Clone mode, or `-m DP-1,HDMI-A-1`).

**Stretch** (`--extend`) spans one image across the monitors. Only static images are stretched; anything else falls back to clone. See [Displays & monitors](/manual/displays).

## Restarts and suspend

Playlists resume after a daemon restart, a crash or a suspend. A restart brings back everything you didn't stop yourself. A paused playlist comes back paused, and the timer starts a fresh interval. Time-of-day goes to the slot for the current time.

After waking from suspend, running playlists catch up. Time-of-day and day-of-week jump to the right image, and a timer advances by one image however long you slept.

Playlists also publish `playlist_*` events; see [Events](/reference/events).
