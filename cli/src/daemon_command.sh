LOCATION="/opt/waypaper-engine/resources/daemon/daemon.js"
COMMAND="node $LOCATION"

if [ -n "${args[--script]}" ]; then
    COMMAND="$COMMAND --script=${args[--script]}"
fi

run_daemon() {
     $COMMAND || echo "Cannot start daemon, something went wrong in the installation"
}

run_daemon > /dev/null &
