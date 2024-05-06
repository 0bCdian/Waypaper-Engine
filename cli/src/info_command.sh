WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"

echo -n '{"action":"get-info"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH | jq || "Something went wrong"
