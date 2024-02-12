LOCATION="/opt/waypaper-engine"
COMMAND="$LOCATION"/waypaper-engine-bin
COMMAND="$COMMAND"

if [ -n "${args["--force-wayland"]}" ]; then
	COMMAND="$COMMAND --ozone-platform-hint=auto"
fi

if [ -n "${args[--script]}" ]; then
	COMMAND="$COMMAND --script=${args[--script]}"
fi

run_app() {
	$COMMAND || echo "Something went wrong, make sure waypaper engine is installed correctly"
}

run_app >/dev/null &
