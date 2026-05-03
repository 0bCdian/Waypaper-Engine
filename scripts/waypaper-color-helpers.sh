#!/usr/bin/env bash
# Shared helpers for pywal / matugen integration (sourced by other scripts).
# Expects these env vars (defaults usually set by the caller before sourcing):
#   WAYPAPER_COLOR_TOOL      pywal | matugen
#   WAYPAPER_PYWAL_ARGS      extra wal args (optional)
#   WAYPAPER_MATUGEN_ARGS    extra matugen args (optional)
#   WAYPAPER_COLOR_ALLOW_VIDEO   non-empty → sample one frame with ffmpeg for video
#   WAYPAPER_COLOR_ALLOW_WEB     non-empty → allow media_type=web
#   WAYPAPER_COLOR_DEBOUNCE_SEC  optional sleep before running the tool

# shellcheck shell=bash

waypaper_color_apply() {
	local path=$1
	case ${WAYPAPER_COLOR_TOOL:?} in
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

# Run wal/matugen for one filesystem path given SSE-style media_type:
# image | web | video (API contract + daemon/internal/wallpaper/apply.go).
waypaper_color_process_path() {
	local path=$1
	local media_type=${2:-image}
	local log_label=${3:-}

	local need_frame work cleanup_msg

	if [[ -z $path || ! -f $path ]]; then
		echo "waypaper-color: no readable file at path=${path:-<empty>} ${log_label}" >&2
		return 0
	fi

	need_frame=
	case $media_type in
		web)
			if [[ -z ${WAYPAPER_COLOR_ALLOW_WEB:-} ]]; then
				echo "waypaper-color: skipping web wallpaper ${log_label}" >&2
				return 0
			fi
			;;
		video)
			if [[ -z ${WAYPAPER_COLOR_ALLOW_VIDEO:-} ]]; then
				echo "waypaper-color: skipping video (WAYPAPER_COLOR_ALLOW_VIDEO=1 + ffmpeg) ${log_label}" >&2
				return 0
			fi
			if ! command -v ffmpeg >/dev/null; then
				echo "waypaper-color: ffmpeg not found ${log_label}" >&2
				return 0
			fi
			need_frame=1
			;;
	esac

	work=$path
	if [[ -n $need_frame ]]; then
		work=$(mktemp "/tmp/waypaper-color.XXXXXX.png")
		if ! ffmpeg -nostdin -y -i "$path" -vframes 1 -q:v 2 "$work" 2>/dev/null; then
			echo "waypaper-color: ffmpeg failed for $path ${log_label}" >&2
			rm -f "$work"
			return 0
		fi
	fi

	if [[ -n ${WAYPAPER_COLOR_DEBOUNCE_SEC:-} && $WAYPAPER_COLOR_DEBOUNCE_SEC != 0 ]]; then
		sleep "$WAYPAPER_COLOR_DEBOUNCE_SEC"
	fi

	echo "waypaper-color: $WAYPAPER_COLOR_TOOL type=$media_type file=$work ${log_label}" >&2
	if ! waypaper_color_apply "$work"; then
		echo "waypaper-color: $WAYPAPER_COLOR_TOOL exited $? ${log_label}" >&2
	fi

	if [[ -n $need_frame ]]; then
		rm -f "$work"
	fi
}
