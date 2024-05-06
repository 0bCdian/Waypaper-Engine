WAYPAPER_LOCATION="/opt/waypaper-engine/waypaper-engine-bin --daemon"

FORMAT="${args[--format]}"
COMMAND="$WAYPAPER_LOCATION"

if [[ $FORMAT -eq 1 ]]; then
	COMMAND="$COMMAND --format"
fi

$COMMAND || "Something went wrong"
