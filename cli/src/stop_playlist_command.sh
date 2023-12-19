SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'

send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

stop_playlist(){
  send_message '{"action":"stop-playlist"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

stop_playlist