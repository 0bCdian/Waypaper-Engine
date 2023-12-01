SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'


send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

previous_image(){
  send_message '{"action":"previous-image"}' 2>/dev/null || echo "Seems like the daemon is not running, make sure to run 'wpe-cli daemon' first"
}

previous_image
