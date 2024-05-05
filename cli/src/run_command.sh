WAYPAPER_LOCATION="/opt/waypaper-engine/waypaper-engine-bin"
WAYPAPER_FLAGS="$HOME/.waypaper_engine/flags.conf"
FORMAT="${args[--format]}"
WAYLAND="${args[--wayland]}"
COMMAND="$WAYPAPER_LOCATION"

if [[ $WAYLAND -eq 1 ]]; then
	COMMAND="$COMMAND --ozone-platform-hint=wayland"
fi
if [[ $FORMAT -eq 1 ]]; then
	COMMAND="$COMMAND --format"
fi

$COMMAND || "Something went wrong"
