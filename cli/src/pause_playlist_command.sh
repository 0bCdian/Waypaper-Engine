SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'


send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

pause_playlist(){
  send_message '{"action":"pause-playlist"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

pause_playlist
