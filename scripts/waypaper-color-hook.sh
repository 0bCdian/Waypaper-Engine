#!/usr/bin/env bash
# Follow Waypaper Engine's SSE stream on the daemon Unix socket. On each
# `wallpaper_changed` event, read **path** and **media_type** from the JSON
# payload (see daemon/API_CONTRACT.md) and run **pywal** or **matugen** on
# that file. Falls back to GET /images/{id} only if path is missing.
#
# Dependencies: curl, jq. Optional: ffmpeg (if WAYPAPER_COLOR_ALLOW_VIDEO=1).
#
# Be advised: **web** wallpapers are skipped unless WAYPAPER_COLOR_ALLOW_WEB=1.
# Video is skipped unless WAYPAPER_COLOR_ALLOW_VIDEO=1 (one frame via ffmpeg).
#
# Examples:
#   WAYPAPER_COLOR_TOOL=pywal ./waypaper-color-hook.sh
#   WAYPAPER_COLOR_TOOL=matugen WAYPAPER_MATUGEN_ARGS='-m dark' ./waypaper-color-hook.sh
#
# Socket: $XDG_RUNTIME_DIR/waypaper-engine.sock (or WAYPAPER_SOCKET)

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=waypaper-color-helpers.sh
source "$SCRIPT_DIR/waypaper-color-helpers.sh"

: "${XDG_RUNTIME_DIR:=/tmp}"
: "${WAYPAPER_SOCKET:=$XDG_RUNTIME_DIR/waypaper-engine.sock}"
# pywal | matugen
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
		if ! command -v wal >/dev/null; then
			echo "error: pywal not on PATH (wal)" >&2
			exit 1
		fi
		;;
	matugen)
		if ! command -v matugen >/dev/null; then
			echo "error: matugen not on PATH" >&2
			exit 1
		fi
		;;
	*)
		echo "error: WAYPAPER_COLOR_TOOL must be 'pywal' or 'matugen', got: $WAYPAPER_COLOR_TOOL" >&2
		exit 1
		;;
esac

http_get() {
	curl -sS --fail --unix-socket "$WAYPAPER_SOCKET" "http://localhost$1"
}

# Gallery GET /images/{id} uses media_type image|video|gif|web — align with SSE.
normalize_gallery_media_type() {
	case $1 in
		gif | image) echo image ;;
		video) echo video ;;
		web) echo web ;;
		*) echo "$1" ;;
	esac
}

process_image_id() {
	local id=$1
	local json path media_type

	[[ -z $id || $id == null ]] && return 0

	if ! json=$(http_get "/images/$id"); then
		echo "waypaper-color-hook: GET /images/$id failed" >&2
		return 0
	fi

	path=$(printf '%s' "$json" | jq -r '.path // empty' 2>/dev/null) || true
	media_type=$(printf '%s' "$json" | jq -r '.media_type // empty' 2>/dev/null) || true
	media_type=$(normalize_gallery_media_type "${media_type:-image}")

	if [[ -z $path || ! -f $path ]]; then
		echo "waypaper-color-hook: no local file for image_id=$id (type=$media_type), skipping" >&2
		return 0
	fi

	waypaper_color_process_path "$path" "$media_type" "image_id=$id"
}

process_wallpaper_sse_payload() {
	local json=$1
	local path media_type id

	path=$(printf '%s' "$json" | jq -r '.path // empty' 2>/dev/null) || true
	media_type=$(printf '%s' "$json" | jq -r '.media_type // empty' 2>/dev/null) || true
	id=$(printf '%s' "$json" | jq -r '.image_id // empty' 2>/dev/null) || true

	[[ -z $media_type ]] && media_type=image

	if [[ -n $path && -f $path ]]; then
		waypaper_color_process_path "$path" "$media_type" "image_id=$id"
		return 0
	fi

	if [[ -n $id && $id != null ]]; then
		echo "waypaper-color-hook: event missing usable path, fetching image_id=$id" >&2
		process_image_id "$id"
	fi
}

current_event=""

while true; do
	while IFS= read -r line || true; do
		[[ -z $line ]] && continue
		[[ $line == :* ]] && continue

		if [[ $line == event:* ]]; then
			current_event=${line#event:}
			current_event=${current_event## }
			current_event=${current_event%%$'\r'}
			continue
		fi
		if [[ $line == data:* ]]; then
			local_data=${line#data:}
			local_data=${local_data## }
			local_data=${local_data%%$'\r'}
			if [[ $current_event == wallpaper_changed && -n $local_data ]]; then
				process_wallpaper_sse_payload "$local_data" || true
			fi
			current_event=""
		fi
	done < <(curl -N -sS --unix-socket "$WAYPAPER_SOCKET" "http://localhost/events?types=wallpaper_changed" || true)
	echo "waypaper-color-hook: stream ended, reconnecting in 2s..." >&2
	sleep 2
done
