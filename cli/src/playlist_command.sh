WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"

execute_command() {
	local argument="$1"
	echo "$argument"
	echo -n "$argument" | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || {
		echo "Something went wrong"
		exit 1
	}
}

ACTIVE_PLAYLISTS=$(echo -n '{"action":"get-info-active-playlist"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq)
SELECTED_PLAYLIST=$(echo "$ACTIVE_PLAYLISTS" | jq ".[]" -c | fzf --border sharp --reverse --no-height --header "Active Playlists" --preview "printf %s {} | jq" -e)
COMMANDS=("next-image" "previous-image" "stop-playlist" "resume-playlist" "pause-playlist")
SELECTED_COMMAND=$(printf "%s\n" "${COMMANDS[@]}" | fzf --border sharp --reverse --no-height --header "Select command" --preview "printf %s {}" -e)
COMMAND=$(echo "$SELECTED_PLAYLIST" | jq "{action:\"$SELECTED_COMMAND\",playlist:{name:.playlistName,activeMonitor:.playlistActiveMonitor}}" -rc)
execute_command "$COMMAND"
