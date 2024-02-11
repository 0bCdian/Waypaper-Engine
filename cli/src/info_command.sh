SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'

send_message() {
	echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

get_info() {
	send_message '{"action":"get-info"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

get_info
