WAYPAPER_LOCATION="/opt/waypaper-engine/waypaper-engine-bin"

SCRIPT="${args[--script]}"
FORMAT="${args[--format]}"
WAYLAND="${args[--wayland]}"
COMMAND="$WAYPAPER_LOCATION"

if [[ $WAYLAND -eq 1 ]]; then
	COMMAND="$COMMAND --ozone-platform-hint=wayland"
fi
if [[ $FORMAT -eq 1 ]]; then
	COMMAND="$COMMAND --format"
fi
if [[ -n $SCRIPT ]]; then
	COMMAND="$COMMAND --script=$SCRIPT"
fi

$COMMAND || "Something went wrong"
