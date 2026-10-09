# Scripting & hooks

`waypaper-daemon` is a full CLI, so keybinds and scripts can drive wallpapers without the GUI. The daemon also streams an event whenever the wallpaper changes, which is how you re-theme the rest of your desktop.

The CLI talks to a running daemon over its Unix socket. If it isn't up, commands fail with "daemon not reachable". The GUI starts it for you; otherwise start it from your compositor config (see [Keybinds](#keybinds)).

## Run a script on every wallpaper change

There's no `on_change` config option. `waypaper-daemon events` prints each event as one JSON line, so a hook is a loop over that output:

```bash
waypaper-daemon events --types wallpaper_changed
```

Useful fields in `data`: `path` (the file; for a web wallpaper, its entry HTML), `media_type` (`image`, `video` or `web`; check it before feeding `path` to a colour tool), `colors` (the gallery palette, if it has one), `monitors`, `mode`, `source` and `backend`. Full payloads in [Events](/reference/events), flags in the [CLI reference](/reference/cli).

### pywal

![pywal re-theming a terminal when the wallpaper changes](/media/pywall.webp)

Needs `jq` and `wal`. `-n` stops pywal setting the wallpaper itself, `-q` keeps it quiet.

```bash
#!/usr/bin/env bash
waypaper-daemon events --types wallpaper_changed |
while read -r event; do
	[[ $(jq -r '.data.media_type' <<<"$event") == image ]] || continue
	img=$(jq -r '.data.path' <<<"$event")
	[[ -f $img ]] && wal -i "$img" -n -q
done
```

### wallust and matugen

Same loop, swap the line inside it (third-party tools, so check `--help` for your version):

```bash
[[ -f $img ]] && wallust run "$img"
[[ -f $img ]] && matugen image "$img"
```

### Keep it running

`events` exits when the daemon goes away, and errors straight away if it isn't up yet. Wrap the loop in a retry and start it from your compositor config:

```bash
#!/usr/bin/env bash
while true; do
	waypaper-daemon events --types wallpaper_changed |
	while read -r event; do
		[[ $(jq -r '.data.media_type' <<<"$event") == image ]] || continue
		wal -i "$(jq -r '.data.path' <<<"$event")" -n -q
	done
	sleep 2
done
```

```ini
# Hyprland
exec-once = ~/.config/waypaper-hooks/retheme.sh
```

A slow tool blocks the loop and events queue behind it; run the heavy part with `&` if you change wallpapers a lot.

### Raw SSE

`events` wraps `GET /events`, a Server-Sent Events stream, so `curl` works too (leave off `?types=` for everything):

```bash
curl -sN --unix-socket "$XDG_RUNTIME_DIR/waypaper-engine.sock" \
  "http://localhost/events?types=wallpaper_changed"
```

## Keybinds

Autostart the daemon, then bind the commands you want:

```ini
# Hyprland (hyprland.conf)
exec-once = waypaper-daemon start

bind = SUPER, W, exec, waypaper-daemon random
bind = SUPER SHIFT, W, exec, waypaper-daemon wallpaper random --monitor DP-1
bind = SUPER, bracketright, exec, waypaper-daemon next
bind = SUPER, bracketleft, exec, waypaper-daemon previous
bind = SUPER, P, exec, waypaper-daemon playlist next-all
```

```ini
# sway (config)
exec waypaper-daemon start
bindsym $mod+w exec waypaper-daemon random
bindsym $mod+bracketright exec waypaper-daemon next
```

- `random`, `next`, `previous` and `set <image-id>` are shortcuts for the `wallpaper` subcommands. `next` and `previous` walk your wallpaper history; they don't advance a playlist (use `playlist next-all`, see [Playlists](/manual/playlists)).
- `random` and `set` take `--monitor/-m` (default `*`) and `--mode` (`individual`, `clone` or `extend`).
- `waypaper-daemon images list` finds image IDs. `wallpaper current` prints the current state as JSON, and the global `--json` flag gives compact output.

::: tip Bind does nothing?
Compositors run `exec` with their own environment. Use the full path (`~/.local/bin/waypaper-daemon`) and check `waypaper-daemon status`.
:::

Building against the HTTP API directly? Start with the [API reference](/reference/api).
