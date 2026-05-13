#!/usr/bin/env bash
set -euo pipefail

# Stale: wal-utauri exposes /wallpaper/parallax and /wallpaper/parallax-move only.
# The daemon’s Hyprland/Sway bridge uses parallax-move (see daemon/internal/parallaxdriver).
# Do not use this script against current wal-qt unless the control API gains a set-offset route.

# send_request <output_name> <offset_x> <offset_y> [socket_path]
# Example:
#   send_request HDMI-A-1 0.15 0
#
# Note:
#   The helper auto-enables parallax on the named output before applying offsets.

default_socket() {
  if [[ -n "${XDG_RUNTIME_DIR:-}" ]]; then
    printf "%s/wal-qt.sock" "$XDG_RUNTIME_DIR"
  else
    printf ""
  fi
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

enable_parallax_for_output() {
  local name="$1"
  local socket="$2"
  local esc
  esc="$(json_escape "$name")"
  local payload="{\"enabled\":true,\"name\":\"${esc}\"}"

  echo "POST /wallpaper/parallax -> name=$name enabled=true socket=$socket"
  curl --silent --show-error --fail \
    --unix-socket "$socket" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$payload" \
    "http://wal-qt.local/wallpaper/parallax" >/dev/null
}

send_request() {
  if [[ $# -lt 3 || $# -gt 4 ]]; then
    echo "Usage: send_request <output_name> <offset_x> <offset_y> [socket_path]" >&2
    return 2
  fi

  local name="$1"
  local offset_x="$2"
  local offset_y="$3"
  local socket="${4:-$(default_socket)}"

  if [[ -z "$socket" ]]; then
    echo "Socket path is empty. Pass it explicitly or set XDG_RUNTIME_DIR." >&2
    return 2
  fi
  if [[ ! -S "$socket" ]]; then
    echo "Socket not found: $socket" >&2
    return 2
  fi
  if [[ -z "$name" ]]; then
    echo "output_name must be non-empty" >&2
    return 2
  fi

  if [[ "${PARALLAX_OFFSET_SKIP_ENABLE:-0}" != "1" ]]; then
    enable_parallax_for_output "$name" "$socket"
  fi

  local esc
  esc="$(json_escape "$name")"
  local payload="{\"offset_x\":${offset_x},\"offset_y\":${offset_y},\"name\":\"${esc}\"}"

  echo "POST /wallpaper/parallax-set-offset -> name=$name offset_x=$offset_x offset_y=$offset_y socket=$socket"
  curl --silent --show-error --fail \
    --unix-socket "$socket" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$payload" \
    "http://wal-qt.local/wallpaper/parallax-set-offset"
  echo
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  send_request "$@"
fi
