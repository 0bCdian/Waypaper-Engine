WAYPAPER_LOCATION="/opt/waypaper-engine/waypaper-engine-bin --daemon"

SCRIPT="${args[--script]}"
FORMAT="${args[--format]}"
COMMAND="$WAYPAPER_LOCATION"

if [[ $FORMAT -eq 1 ]]; then
	COMMAND="$COMMAND --format"
fi
if [[ -n $SCRIPT ]]; then
	COMMAND="$COMMAND --script=$SCRIPT"
fi

$COMMAND || "Something went wrong"
