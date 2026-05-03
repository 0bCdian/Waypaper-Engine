#!/usr/bin/env bash
# One-shot: GET /wallpaper/current (daemon/API_CONTRACT.md), take image_path,
# optionally resolve media_type via GET /images/{id}, then run pywal or matugen.
# Useful after login or in systemd/hyprland exec-once to match the wallpaper
# already applied by Waypaper Engine.
#
# Same environment variables as waypaper-color-hook.sh:
#   WAYPAPER_COLOR_TOOL, WAYPAPER_PYWAL_ARGS, WAYPAPER_MATUGEN_ARGS,
#   WAYPAPER_COLOR_ALLOW_VIDEO, WAYPAPER_COLOR_ALLOW_WEB,
#   WAYPAPER_SOCKET, XDG_RUNTIME_DIR
#
# Examples:
#   ./waypaper-colors-from-current.sh
#   WAYPAPER_COLOR_TOOL=matugen ./waypaper-colors-from-current.sh

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=waypaper-color-helpers.sh
source "$SCRIPT_DIR/waypaper-color-helpers.sh"

: "${XDG_RUNTIME_DIR:=/tmp}"
: "${WAYPAPER_SOCKET:=$XDG_RUNTIME_DIR/waypaper-engine.sock}"
: "${WAYPAPER_COLOR_TOOL:=pywal}"
: "${WAYPAPER_PYWAL_ARGS:=-n -q}"
: "${WAYPAPER_MATUGEN_ARGS:=}"
: "${WAYPAPER_COLOR_ALLOW_VIDEO:=}"
: "${WAYPAPER_COLOR_ALLOW_WEB:=}"
: "${WAYPAPER_COLOR_DEBOUNCE_SEC:=0}"

if ! command -v curl >/dev/null; then
	echo "error: curl not found" >&2
	exit 1
fi
if ! command -v jq >/dev/null; then
	echo "error: jq not found" >&2
	exit 1
fi
if [[ ! -S $WAYPAPER_SOCKET ]]; then
	echo "error: not a socket: $WAYPAPER_SOCKET (is the daemon running?)" >&2
	exit 1
fi

case $WAYPAPER_COLOR_TOOL in
	pywal)
		command -v wal >/dev/null || {
			echo "error: pywal not on PATH (wal)" >&2
			exit 1
		}
		;;
	matugen)
		command -v matugen >/dev/null || {
			echo "error: matugen not on PATH" >&2
			exit 1
		}
		;;
	*)
		echo "error: WAYPAPER_COLOR_TOOL must be 'pywal' or 'matugen'" >&2
		exit 1
		;;
esac

http_get() {
	curl -sS --fail --unix-socket "$WAYPAPER_SOCKET" "http://localhost$1"
}

normalize_gallery_media_type() {
	case $1 in
		gif | image) echo image ;;
		video) echo video ;;
		web) echo web ;;
		*) echo "$1" ;;
	esac
}

json=$(http_get "/wallpaper/current") || {
	echo "error: GET /wallpaper/current failed (daemon running?)" >&2
	exit 1
}

path=$(printf '%s' "$json" | jq -r '.image_path // empty')
id=$(printf '%s' "$json" | jq -r '.image_id // empty')

if [[ -z $path ]]; then
	echo "error: no wallpaper set for active backend (empty image_path)" >&2
	exit 1
fi

media_type=image
if [[ -n $id && $id != null ]]; then
	if meta=$(http_get "/images/$id"); then
		mt=$(printf '%s' "$meta" | jq -r '.media_type // empty')
		[[ -n $mt ]] && media_type=$(normalize_gallery_media_type "$mt")
	fi
fi

waypaper_color_process_path "$path" "$media_type" "from GET /wallpaper/current"
