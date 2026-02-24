#!/bin/sh

GUI_BIN="/opt/waypaper-engine/waypaper-engine-bin"
DAEMON_BIN="${WAYPAPER_DAEMON_BIN:-waypaper-daemon}"

print_help() {
	cat <<'EOF'
Usage:
  waypaper-engine [run|gui] [electron args...]
  waypaper-engine daemon <daemon args...>
  waypaper-engine <daemon args...>

Examples:
  waypaper-engine
  waypaper-engine run
  waypaper-engine daemon start
  waypaper-engine status
EOF
}

if [ $# -eq 0 ]; then
	exec "$GUI_BIN"
fi

case "$1" in
run|gui)
	shift
	exec "$GUI_BIN" "$@"
	;;
daemon)
	shift
	exec "$DAEMON_BIN" "$@"
	;;
-h|--help|help)
	print_help
	exit 0
	;;
*)
	# Default to daemon command passthrough for a single public executable.
	exec "$DAEMON_BIN" "$@"
	;;
esac
