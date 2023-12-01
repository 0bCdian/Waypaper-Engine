SOCKET_CONNECTION='/tmp/waypaper_engine_daemon.sock'

send_message(){
  echo -n "$1" | socat - UNIX-CONNECT:"$SOCKET_CONNECTION"
}

resume_playlist(){
  send_message '{"action":"resume-playlist"}' 2>/dev/null || echo "Seems like the daemon is not running, make sure to run 'wpe-cli daemon' first"
}

resume_playlist
