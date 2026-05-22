#!/usr/bin/env bash
# When Waypaper Engine changes the wallpaper, pywal themes your terminal from it.
# Needs: waypaper-daemon (CLI), jq, wal — daemon must be running.

waypaper-daemon events --types wallpaper_changed |
while read -r event; do
	[[ $(jq -r '.data.media_type' <<<"$event") == image ]] || continue
	img=$(jq -r '.data.path' <<<"$event")
	[[ -f $img ]] && wal -i "$img" -n -q
done
