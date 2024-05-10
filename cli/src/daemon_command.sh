WAYPAPER_LOCATION="/opt/waypaper-engine/waypaper-engine-bin --daemon"

FORMAT="${args[--format]}"
LOG="${args[--logs]}"
COMMAND="$WAYPAPER_LOCATION"

if [[ $FORMAT -eq 1 ]]; then
	COMMAND="$COMMAND --format"
fi
if [[ $LOG -eq 1 ]]; then
	COMMAND="$COMMAND --logs"
fi
$COMMAND || "Something went wrong"
