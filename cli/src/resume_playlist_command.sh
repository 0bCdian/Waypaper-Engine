SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'

send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

resume_playlist(){
  send_message '{"action":"resume-playlist"}' || echo "Seems like the daemon is not running, make sure to run 'waypaper-engine daemon' first"
}

resume_playlist
