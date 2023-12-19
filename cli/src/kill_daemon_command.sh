kill_daemon() {
  killall wpe-daemon || echo "Waypaper daemon not running"
}

kill_daemon > /dev/null &