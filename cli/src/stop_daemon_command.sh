WAYPAPER_ENGINE_DAEMON_SOCKET_PATH="/tmp/waypaper_engine_daemon.sock"

echo -n '{"action":"stop-daemon"}' | socat - UNIX-CONNECT:$WAYPAPER_ENGINE_DAEMON_SOCKET_PATH >/dev/null || "Something went wrong"
