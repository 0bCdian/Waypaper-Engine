# CLI reference

`waypaper-daemon` with no subcommand runs the daemon. Subcommands talk to a running daemon over its Unix socket. The global `--json` flag prints raw JSON for scripting.

## Global flags

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--config` | `-c` |  | config file path (default: $XDG_CONFIG_HOME/waypaper-engine/config.toml) |
| `--json` |  | `false` | output raw compact JSON (for scripting) |
| `--lock-path` |  |  | override PID lock file path (for testing) |
| `--log-level` | `-l` |  | override log level (debug, info, warn, error) |

## waypaper-daemon backends

```sh
waypaper-daemon backends
```

List and manage wallpaper backends

## waypaper-daemon backends activate

```sh
waypaper-daemon backends activate [name]
```

Activate a wallpaper backend (e.g. awww, feh, hyprpaper)

## waypaper-daemon config

```sh
waypaper-daemon config
```

View and manage daemon configuration

## waypaper-daemon config get

```sh
waypaper-daemon config get [section]
```

Get a specific config section (e.g. daemon, app, backend)

## waypaper-daemon config set

```sh
waypaper-daemon config set [section] [json-body]
```

Patch a config section with a raw JSON object.

Example:
  waypaper-daemon config set daemon '{"log_level":"debug"}'

## waypaper-daemon events

```sh
waypaper-daemon events [flags]
```

Connect to the daemon's SSE event stream and print each event as a
JSON line to stdout. Useful for scripting and piping.

Example:
  waypaper-daemon events --types wallpaper_changed,playlist_started

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--types` |  |  | comma-separated event types to filter (e.g. wallpaper_changed,playlist_started) |

## waypaper-daemon folders

```sh
waypaper-daemon folders
```

List, create, update, delete, and navigate image folders.

## waypaper-daemon folders create

```sh
waypaper-daemon folders create [name] [flags]
```

Create a new folder

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--parent-id` |  | `0` | parent folder ID |

## waypaper-daemon folders delete

```sh
waypaper-daemon folders delete [id] [flags]
```

Delete a folder

Aliases: `rm`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--mode` |  |  | deletion mode (keep_contents, delete_all) |

## waypaper-daemon folders get

```sh
waypaper-daemon folders get [id]
```

Get details for a specific folder

## waypaper-daemon folders list

```sh
waypaper-daemon folders list [flags]
```

List all folders

Aliases: `ls`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--parent-id` |  |  | filter by parent folder ID |

## waypaper-daemon folders move-images

```sh
waypaper-daemon folders move-images [flags]
```

Move images to a folder

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--folder-id` |  | `0` | target folder ID |
| `--image-ids` |  |  | comma-separated image IDs to move |

## waypaper-daemon folders path

```sh
waypaper-daemon folders path [id]
```

Show the breadcrumb path for a folder

## waypaper-daemon folders update

```sh
waypaper-daemon folders update [id] [flags]
```

Update a folder

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` |  |  | new folder name |
| `--parent-id` |  | `0` | new parent folder ID |

## waypaper-daemon images

```sh
waypaper-daemon images
```

List, add, delete, update, rename, and inspect images managed by the daemon.

## waypaper-daemon images add

```sh
waypaper-daemon images add [paths...]
```

Add one or more images to the gallery. The daemon will process them
asynchronously (copy to cache, generate thumbnails, extract metadata).

## waypaper-daemon images cancel-import

```sh
waypaper-daemon images cancel-import [batch-id]
```

Cancel a running image import batch

## waypaper-daemon images delete

```sh
waypaper-daemon images delete [ids...]
```

Delete images from the gallery by ID

Aliases: `rm`

## waypaper-daemon images get

```sh
waypaper-daemon images get [id]
```

Get details for a specific image

## waypaper-daemon images history

```sh
waypaper-daemon images history
```

View or clear wallpaper change history.

## waypaper-daemon images history clear

```sh
waypaper-daemon images history clear
```

Clear wallpaper change history

## waypaper-daemon images history list

```sh
waypaper-daemon images history list [flags]
```

Show wallpaper change history

Aliases: `ls`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--limit` | `-n` | `20` | maximum number of entries to show |
| `--monitor` | `-m` |  | filter by monitor name |

## waypaper-daemon images import

```sh
waypaper-daemon images import [paths...]
```

Import one or more images into the gallery. Glob patterns like *.jpg
are resolved to absolute paths before sending to the daemon.

## waypaper-daemon images list

```sh
waypaper-daemon images list [flags]
```

List images in the gallery

Aliases: `ls`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--media-type` |  |  | filter by media type |
| `--page` | `-p` | `1` | page number |
| `--per-page` | `-n` | `50` | items per page |
| `--search` | `-s` |  | search filter |
| `--sort-by` |  |  | sort field (name, created_at, updated_at) |
| `--sort-order` |  |  | sort order (asc, desc) |

## waypaper-daemon images tags

```sh
waypaper-daemon images tags
```

List all unique image tags

## waypaper-daemon images update

```sh
waypaper-daemon images update [id] [flags]
```

Update image metadata

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--colors` |  |  | comma-separated colors |
| `--tags` |  |  | comma-separated tags |

## waypaper-daemon monitors

```sh
waypaper-daemon monitors
```

List and inspect connected monitors

Aliases: `mon`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--direct` |  | `false` | query monitor providers in-process instead of via the daemon socket (diagnostic) |

## waypaper-daemon monitors get

```sh
waypaper-daemon monitors get [name]
```

Get details for a specific monitor

## waypaper-daemon next

```sh
waypaper-daemon next
```

Go to next wallpaper in history (shortcut for 'wallpaper next')

## waypaper-daemon playlist

```sh
waypaper-daemon playlist
```

List, inspect, create, update, delete, and control playlists on the daemon.

Aliases: `pl`

## waypaper-daemon playlist active

```sh
waypaper-daemon playlist active
```

List all active (running) playlists

## waypaper-daemon playlist create

```sh
waypaper-daemon playlist create [name] [flags]
```

Create a new playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--interval` |  | `0` | interval in seconds (for timer type) |
| `--order` |  |  | playback order (ordered, random) |
| `--type` |  |  | playlist type (timer, manual, time_of_day, day_of_week) |

## waypaper-daemon playlist delete

```sh
waypaper-daemon playlist delete [id] [flags]
```

Delete a playlist

Aliases: `rm`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist get

```sh
waypaper-daemon playlist get [id] [flags]
```

Get details for a specific playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist list

```sh
waypaper-daemon playlist list
```

List all playlists

Aliases: `ls`

## waypaper-daemon playlist next

```sh
waypaper-daemon playlist next [id] [flags]
```

Advance to next image in a playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist next-all

```sh
waypaper-daemon playlist next-all
```

Advance all running playlists to next image

## waypaper-daemon playlist pause

```sh
waypaper-daemon playlist pause [id] [flags]
```

Pause a running playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist pause-all

```sh
waypaper-daemon playlist pause-all
```

Pause all running playlists

## waypaper-daemon playlist prev

```sh
waypaper-daemon playlist prev [id] [flags]
```

Go back to previous image in a playlist

Aliases: `previous`

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist prev-all

```sh
waypaper-daemon playlist prev-all
```

Reverse all running playlists to previous image

Aliases: `previous-all`

## waypaper-daemon playlist resume

```sh
waypaper-daemon playlist resume [id] [flags]
```

Resume a paused playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist resume-all

```sh
waypaper-daemon playlist resume-all
```

Resume all paused playlists

## waypaper-daemon playlist start

```sh
waypaper-daemon playlist start [id] [flags]
```

Start a playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--extend` |  | `false` | span one image across the monitors instead of cloning it |
| `--monitors` | `-m` |  | comma-separated monitor names (default: all connected) |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist stop

```sh
waypaper-daemon playlist stop [id] [flags]
```

Stop a running playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--name` | `-N` |  | playlist name (alternative to ID) |

## waypaper-daemon playlist stop-all

```sh
waypaper-daemon playlist stop-all
```

Stop all running playlists

## waypaper-daemon playlist update

```sh
waypaper-daemon playlist update [id] [flags]
```

Update a playlist

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--add-images` |  |  | comma-separated image IDs to add |
| `--interval` |  | `0` | interval in seconds |
| `--name` | `-N` |  | playlist name (alternative to ID) |
| `--order` |  |  | playback order (ordered, random) |
| `--playlist-name` |  |  | new playlist name |
| `--remove-images` |  |  | comma-separated image IDs to remove |
| `--type` |  |  | playlist type (timer, manual, time_of_day, day_of_week) |

## waypaper-daemon previous

```sh
waypaper-daemon previous
```

Go to previous wallpaper in history (shortcut for 'wallpaper previous')

Aliases: `prev`

## waypaper-daemon random

```sh
waypaper-daemon random [flags]
```

Set a random wallpaper (shortcut for 'wallpaper random')

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--mode` |  | `individual` | monitor mode (individual, clone, extend) |
| `--monitor` | `-m` | `*` | target monitor name (* for all) |

## waypaper-daemon set

```sh
waypaper-daemon set [image-id] [flags]
```

Set a wallpaper by image ID (shortcut for 'wallpaper set')

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--mode` |  | `individual` | monitor mode (individual, clone, extend) |
| `--monitor` | `-m` | `*` | target monitor name (* for all) |

## waypaper-daemon start

```sh
waypaper-daemon start
```

Start the daemon (default action)

## waypaper-daemon status

```sh
waypaper-daemon status
```

Show daemon status and info

## waypaper-daemon stop

```sh
waypaper-daemon stop
```

Stop the running daemon

## waypaper-daemon version

```sh
waypaper-daemon version
```

Print daemon version

## waypaper-daemon wallpaper

```sh
waypaper-daemon wallpaper
```

View current wallpaper and change wallpapers by ID or randomly.

Aliases: `wp`

## waypaper-daemon wallpaper current

```sh
waypaper-daemon wallpaper current
```

Show current wallpaper state for the active backend (JSON)

## waypaper-daemon wallpaper next

```sh
waypaper-daemon wallpaper next
```

Go to next wallpaper in history

## waypaper-daemon wallpaper previous

```sh
waypaper-daemon wallpaper previous
```

Go to previous wallpaper in history

Aliases: `prev`

## waypaper-daemon wallpaper random

```sh
waypaper-daemon wallpaper random [flags]
```

Set a random wallpaper

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--mode` |  | `individual` | monitor mode (individual, clone, extend) |
| `--monitor` | `-m` | `*` | target monitor name (* for all) |

## waypaper-daemon wallpaper set

```sh
waypaper-daemon wallpaper set [image-id] [flags]
```

Set a wallpaper by image ID

| Flag | Shorthand | Default | Description |
| --- | --- | --- | --- |
| `--mode` |  | `individual` | monitor mode (individual, clone, extend) |
| `--monitor` | `-m` | `*` | target monitor name (* for all) |
