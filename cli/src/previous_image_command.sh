WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"
PLAYLIST="${args[playlist]}"
ACTIVE_MONITOR="${args[active_monitor]}"
COMMAND="previous-image"
COMMAND_ALL="previous-image-all"
execute_command() {
	local argument="$1"
	echo "$argument" | jq
	echo -n "$argument" | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || {
		echo "Something went wrong"
		exit 1
	}
}

if [[ -z "$PLAYLIST" ]]; then
	execute_command "{\"action\": \"$COMMAND_ALL\"}"
elif [[ -z "$ACTIVE_MONITOR" ]]; then
	execute_command "{\"action\": \"$COMMAND\", \"playlist\": {\"name\": \"$PLAYLIST\"}}"
else
	execute_command "{\"action\": \"$COMMAND\", \"playlist\": {\"name\": \"$PLAYLIST\", \"activeMonitor\":{\"name\":\"$ACTIVE_MONITOR\"}}}"
fi
