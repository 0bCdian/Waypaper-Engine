#!/usr/bin/env bash
# Print the filesystem path from each wallpaper_changed SSE event (one path per line).
# Uses the same payload fields as daemon/API_CONTRACT.md (`path`).
#
# Examples:
#   ./waypaper-wallpaper-path-watch.sh | while read -r p; do echo "→ $p"; done
#   ./waypaper-wallpaper-path-watch.sh > ~/.local/state/waypaper-last-path
#
# Dependencies: curl, jq. Socket: WAYPAPER_SOCKET or default Unix socket.

set -euo pipefail

: "${XDG_RUNTIME_DIR:=/tmp}"
: "${WAYPAPER_SOCKET:=$XDG_RUNTIME_DIR/waypaper-engine.sock}"

if ! command -v curl >/dev/null || ! command -v jq >/dev/null; then
	echo "error: need curl and jq" >&2
	exit 1
fi
if [[ ! -S $WAYPAPER_SOCKET ]]; then
	echo "error: not a socket: $WAYPAPER_SOCKET" >&2
	exit 1
fi

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
				p=$(printf '%s' "$local_data" | jq -r '.path // empty' 2>/dev/null) || true
				[[ -n $p ]] && printf '%s\n' "$p"
			fi
			current_event=""
		fi
	done < <(curl -N -sS --unix-socket "$WAYPAPER_SOCKET" "http://localhost/events?types=wallpaper_changed" || true)
	sleep 2
done
