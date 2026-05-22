#!/usr/bin/env bash
# Connect to the Waypaper Engine daemon Unix socket and print every SSE event
# (Server-Sent Events on GET /events). Handy for debugging and automation.
#
# Dependencies: curl. Optional: jq (pretty-prints JSON payloads).
#
# By default you receive all event types. Restrict with WAYPAPER_EVENTS_TYPES
# (comma-separated), same as the HTTP ?types= query.
#
# Examples:
#   ./waypaper-events-watch.sh
#   WAYPAPER_EVENTS_TYPES=wallpaper_changed,config_changed ./waypaper-events-watch.sh
#
# Socket: $XDG_RUNTIME_DIR/waypaper-engine.sock (or WAYPAPER_SOCKET)

set -euo pipefail

: "${XDG_RUNTIME_DIR:=/tmp}"
: "${WAYPAPER_SOCKET:=$XDG_RUNTIME_DIR/waypaper-engine.sock}"

if ! command -v curl >/dev/null; then
	echo "error: curl not found" >&2
	exit 1
fi
if [[ ! -S $WAYPAPER_SOCKET ]]; then
	echo "error: not a socket: $WAYPAPER_SOCKET (is the daemon running?)" >&2
	exit 1
fi

path="/events"
if [[ -n ${WAYPAPER_EVENTS_TYPES:-} ]]; then
	path="/events?types=${WAYPAPER_EVENTS_TYPES}"
fi

current_event=""

print_payload() {
	local ev=$1
	local data=$2
	if [[ -z $data ]]; then
		return
	fi
	printf '%s\n' "--- $ev ---"
	if command -v jq >/dev/null 2>&1; then
		printf '%s' "$data" | jq . 2>/dev/null || printf '%s\n' "$data"
	else
		printf '%s\n' "$data"
	fi
	printf '\n'
}

# Keep reconnecting if the daemon restarts
while true; do
	while IFS= read -r line || true; do
		[[ -z $line ]] && continue
		# SSE comments (e.g. ": keepalive" heartbeats)
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
			ev=$current_event
			[[ -z $ev ]] && ev="(no event: line)"
			if [[ -n $local_data ]]; then
				print_payload "$ev" "$local_data"
			fi
			current_event=""
		fi
	done < <(curl -N -sS --unix-socket "$WAYPAPER_SOCKET" "http://localhost$path" || true)
	echo "waypaper-events-watch: stream ended, reconnecting in 2s..." >&2
	sleep 2
done
