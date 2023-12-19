LOCATION="/opt/waypaper-engine/resources/daemon/daemon.js"

run_daemon() {
      node "$LOCATION" || echo "Cannot start daemon, something went wrong in the installation"
}

run_daemon > /dev/null &
