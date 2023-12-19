
SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'


send_message(){
  echo -n $1 | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

next_image(){
  send_message '{"action":"next-image"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

next_image
