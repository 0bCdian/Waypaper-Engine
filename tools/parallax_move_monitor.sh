#!/usr/bin/env bash
set -euo pipefail

# send_request <monitor_index> <direction> [amount_percent] [socket_path]
# Example:
#   send_request 0 r
#   send_request 1 left 12.5
#
# Direction aliases:
#   r/right, l/left, u/up, d/down
#
# Note:
#   The helper auto-enables parallax on the target monitor before moving.

default_socket() {
  if [[ -n "${XDG_RUNTIME_DIR:-}" ]]; then
    printf "%s/wayland-utauri.sock" "$XDG_RUNTIME_DIR"
  else
    printf ""
  fi
}

normalize_direction() {
  local raw="${1,,}"
  case "$raw" in
    r|right) printf "right" ;;
    l|left) printf "left" ;;
    u|up) printf "up" ;;
    d|down) printf "down" ;;
    *)
      echo "Invalid direction: '$1' (use r/l/u/d or right/left/up/down)" >&2
      return 1
      ;;
  esac
}

enable_parallax_for_monitor() {
  local monitor="$1"
  local socket="$2"
  local payload="{\"enabled\":true,\"monitor\":$monitor}"

  echo "POST /wallpaper/parallax -> monitor=$monitor enabled=true socket=$socket"
  curl --silent --show-error --fail \
    --unix-socket "$socket" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$payload" \
    "http://wayland-utauri.local/wallpaper/parallax" >/dev/null
}

send_request() {
  if [[ $# -lt 2 || $# -gt 4 ]]; then
    echo "Usage: send_request <monitor_index> <direction> [amount_percent] [socket_path]" >&2
    return 2
  fi

  local monitor="$1"
  local direction
  direction="$(normalize_direction "$2")"
  local amount="${3:-}"
  local socket="${4:-$(default_socket)}"

  if [[ -z "$socket" ]]; then
    echo "Socket path is empty. Pass it explicitly or set XDG_RUNTIME_DIR." >&2
    return 2
  fi
  if [[ ! -S "$socket" ]]; then
    echo "Socket not found: $socket" >&2
    return 2
  fi
  if ! [[ "$monitor" =~ ^[0-9]+$ ]]; then
    echo "monitor_index must be a non-negative integer (got '$monitor')" >&2
    return 2
  fi

  # Ensure parallax is enabled for this monitor before attempting a move.
  # Set PARALLAX_MOVE_SKIP_ENABLE=1 to skip this behavior.
  if [[ "${PARALLAX_MOVE_SKIP_ENABLE:-0}" != "1" ]]; then
    enable_parallax_for_monitor "$monitor" "$socket"
  fi

  local payload
  if [[ -n "$amount" ]]; then
    payload="{\"direction\":\"$direction\",\"monitor\":$monitor,\"amount_percent\":$amount}"
  else
    payload="{\"direction\":\"$direction\",\"monitor\":$monitor}"
  fi

  echo "POST /wallpaper/parallax-move -> monitor=$monitor direction=$direction amount=${amount:-default-step} socket=$socket"
  curl --silent --show-error --fail \
    --unix-socket "$socket" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$payload" \
    "http://wayland-utauri.local/wallpaper/parallax-move"
  echo
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  send_request "$@"
fi

