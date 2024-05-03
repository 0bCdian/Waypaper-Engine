WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"

execute_command() {
	local argument="$1"
	echo -n "$argument" | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || {
		echo "Something went wrong"
		exit 1
	}
}

HISTORY=$(echo -n '{"action":"get-image-history"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || "Something went wrong")
SELECTED_OBJECT=$(echo "$HISTORY" | jq ".[]" -c | fzf --border sharp --reverse --no-height --header "Select image to set" --preview "printf %s {} | jq" -e)
COMMAND=$(echo "$SELECTED_OBJECT" | jq "{action:\"set-image\",image:.Images,activeMonitor:.imageHistory.monitor}" -rc)

execute_command "$COMMAND"
