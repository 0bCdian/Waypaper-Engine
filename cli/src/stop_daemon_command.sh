SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'

send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

stop_daemon(){
  send_message '{"action":"stop-daemon"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

stop_daemon > /dev/null &
