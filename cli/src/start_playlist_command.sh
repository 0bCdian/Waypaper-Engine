WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"

execute_command() {
	local argument="$1"
	echo -n "$argument" | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || {
		echo "Something went wrong"
		exit 1
	}
}

PLAYLISTS=$(echo -n '{"action":"get-info-playlist"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq)
SELECTED_PLAYLIST=$(echo "$PLAYLISTS" | jq ".[]" -c | fzf --border sharp --reverse --no-height --header "Select a playlists" --preview "printf %s {} | jq" -e)
MONITORS=$(echo -n '{"action":"get-info"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq)
SELECTED_MONITORS=$(echo "$MONITORS" | jq ".[]" -c | fzf --border sharp --reverse --no-height --multi --header "Select a monitor" --preview "printf %s {} | jq" -e | jq -s "sort_by(.position.x)")
NAMES=$(echo "$SELECTED_MONITORS" | jq -r 'map(.name) | join(",")')
MODES=("extend" "clone")
if [ "$(echo "$SELECTED_MONITORS" | jq length)" -gt 1 ]; then
	SELECTED_MODE=$(printf "%s\n" "${MODES[@]}" | fzf --border sharp --reverse --no-height --header "Select monitor mode" --preview "printf %s {}" -e)
	if [ "$SELECTED_MODE" == "extend" ]; then
		# If it is, set the boolean variable to true
		EXTEND=true
	else
		# Otherwise, set it to false
		EXTEND=false
	fi
else
	EXTEND=false
fi
COMMAND=$(echo "$SELECTED_PLAYLIST" | jq -rc "{action:\"start-playlist\",playlist:{name:.playlist.name,activeMonitor:{name:\"$NAMES\",monitors:$SELECTED_MONITORS,extendAcrossMonitors:$EXTEND}}}")

execute_command "$COMMAND"
