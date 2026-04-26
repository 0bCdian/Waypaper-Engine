#!/usr/bin/env bash
# Follow Waypaper Engine's SSE stream on the daemon Unix socket. On each
# `wallpaper_changed` event, resolve the file path and run **pywal** or **matugen**
# from that image.
#
# Dependencies: curl, jq. Optional: ffmpeg (if WAYPAPER_COLOR_ALLOW_VIDEO=1).
#
# Be advised: **web** / HTML wallpapers use a different pipeline; this script
# **skips** `media_type=web` by default. Video is skipped unless
# WAYPAPER_COLOR_ALLOW_VIDEO=1 (one frame via ffmpeg).
#
# Examples:
#   WAYPAPER_COLOR_TOOL=pywal ./waypaper-color-hook.sh
#   WAYPAPER_COLOR_TOOL=matugen WAYPAPER_MATUGEN_ARGS='-m dark' ./waypaper-color-hook.sh
#
# Socket: $XDG_RUNTIME_DIR/waypaper-engine.sock (or WAYPAPER_SOCKET)

set -euo pipefail

: "${XDG_RUNTIME_DIR:=/tmp}"
: "${WAYPAPER_SOCKET:=$XDG_RUNTIME_DIR/waypaper-engine.sock}"
# pywal | matugen
: "${WAYPAPER_COLOR_TOOL:=pywal}"
# Extra args (word-split; use a wrapper if you need complex quoting)
: "${WAYPAPER_PYWAL_ARGS:=-n -q}"
: "${WAYPAPER_MATUGEN_ARGS:=}"
# Non-empty: also run for media_type=video (ffmpeg samples one frame)
: "${WAYPAPER_COLOR_ALLOW_VIDEO:=}"
# Non-empty: do not skip media_type=web (still needs a real file at .path)
: "${WAYPAPER_COLOR_ALLOW_WEB:=}"
# If set and > 0, sleep that many seconds before each color run (coalesce bursts)
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

apply_colors() {
	local path=$1
	case $WAYPAPER_COLOR_TOOL in
		pywal)
			# shellcheck disable=SC2086
			wal -i "$path" $WAYPAPER_PYWAL_ARGS
			;;
		matugen)
			# shellcheck disable=SC2086
			matugen image "$path" $WAYPAPER_MATUGEN_ARGS
			;;
	esac
}

process_image_id() {
	local id=$1
	local path media_type need_frame work json
	[[ -z $id || $id == null ]] && return 0

	if ! json=$(http_get "/images/$id"); then
		echo "waypaper-color-hook: GET /images/$id failed" >&2
		return 0
	fi

	path=$(printf '%s' "$json" | jq -r '.path // empty' 2>/dev/null) || true
	media_type=$(printf '%s' "$json" | jq -r '.media_type // empty' 2>/dev/null) || true

	if [[ -z $path || ! -f $path ]]; then
		echo "waypaper-color-hook: no local file for image_id=$id (type=$media_type), skipping" >&2
		return 0
	fi

	need_frame=
	case $media_type in
		web)
			if [[ -z ${WAYPAPER_COLOR_ALLOW_WEB:-} ]]; then
				echo "waypaper-color-hook: skipping web wallpaper (id=$id)" >&2
				return 0
			fi
			;;
		video)
			if [[ -z ${WAYPAPER_COLOR_ALLOW_VIDEO:-} ]]; then
				echo "waypaper-color-hook: skipping video (set WAYPAPER_COLOR_ALLOW_VIDEO=1; needs ffmpeg), id=$id" >&2
				return 0
			fi
			if ! command -v ffmpeg >/dev/null; then
				echo "waypaper-color-hook: ffmpeg not found" >&2
				return 0
			fi
			need_frame=1
			;;
	esac

	work=$path
	if [[ -n $need_frame ]]; then
		work=$(mktemp "/tmp/waypaper-color-hook.XXXXXX.png")
		if ! ffmpeg -nostdin -y -i "$path" -vframes 1 -q:v 2 "$work" 2>/dev/null; then
			echo "waypaper-color-hook: ffmpeg failed for $path" >&2
			rm -f "$work"
			return 0
		fi
		cleanup_frame() { rm -f "$work"; }
		trap cleanup_frame RETURN
	fi

	# Optional delay to coalesce rapid duplicate events (e.g. 0.3)
	if [[ -n $WAYPAPER_COLOR_DEBOUNCE_SEC && $WAYPAPER_COLOR_DEBOUNCE_SEC != 0 ]]; then
		sleep "$WAYPAPER_COLOR_DEBOUNCE_SEC"
	fi

	echo "waypaper-color-hook: image_id=$id type=$media_type -> $WAYPAPER_COLOR_TOOL $work" >&2
	apply_colors "$work" || echo "waypaper-color-hook: $WAYPAPER_COLOR_TOOL exited $? (continuing stream)" >&2

	if [[ -n $need_frame ]]; then
		trap - RETURN
		rm -f "$work"
	fi
}

current_event=""

# Keep reconnecting if the daemon restarts
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
				id=$(
					printf '%s' "$local_data" | jq -e -r '.image_id // empty' 2>/dev/null || true
				)
				[[ -n $id ]] && process_image_id "$id" || true
			fi
			current_event=""
		fi
	done < <(curl -N -sS --unix-socket "$WAYPAPER_SOCKET" "http://localhost/events?types=wallpaper_changed" || true)
	echo "waypaper-color-hook: stream ended, reconnecting in 2s..." >&2
	sleep 2
done
