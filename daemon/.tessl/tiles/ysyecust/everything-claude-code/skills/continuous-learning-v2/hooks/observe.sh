#!/bin/bash
set -e

# Hook script for capturing PreToolUse/PostToolUse events as observations.
# Writes structured observation data to ~/.claude/homunculus/observations.jsonl
# for later analysis by the observer agent.

# --- Configuration ---
CONFIG_DIR="$HOME/.claude/homunculus"
OBSERVATIONS_FILE="$CONFIG_DIR/observations.jsonl"
MAX_FILE_SIZE_MB=10
OBSERVER_PID_FILE="$CONFIG_DIR/observer.pid"

# --- Ensure directories exist ---
mkdir -p "$CONFIG_DIR"

# --- Parse event from stdin ---
# Claude Code hooks receive JSON on stdin with event details.
# We use python3 for reliable JSON parsing.
parse_event() {
    python3 -c "
import json, sys, time

try:
    event = json.load(sys.stdin)
except (json.JSONDecodeError, Exception):
    sys.exit(0)

hook_type = event.get('hook', '')
tool_name = event.get('tool_name', '')
tool_input = event.get('tool_input', {})
tool_output = event.get('tool_output', None)
session_id = event.get('session_id', 'unknown')

# Build observation record
observation = {
    'timestamp': time.time(),
    'iso_time': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
    'session_id': session_id,
    'hook_type': hook_type,
    'tool_name': tool_name,
}

if hook_type == 'PreToolUse':
    observation['phase'] = 'pre'
    observation['tool_input'] = tool_input
elif hook_type == 'PostToolUse':
    observation['phase'] = 'post'
    observation['tool_input'] = tool_input
    if tool_output is not None:
        # Truncate large outputs to keep file manageable
        output_str = str(tool_output)
        if len(output_str) > 2000:
            output_str = output_str[:2000] + '...[truncated]'
        observation['tool_output_preview'] = output_str

print(json.dumps(observation))
"
}

# --- Rotate file if too large ---
rotate_if_needed() {
    if [ -f "$OBSERVATIONS_FILE" ]; then
        local file_size_bytes
        file_size_bytes=$(stat -f%z "$OBSERVATIONS_FILE" 2>/dev/null || stat --format=%s "$OBSERVATIONS_FILE" 2>/dev/null || echo 0)
        local max_size_bytes=$((MAX_FILE_SIZE_MB * 1024 * 1024))

        if [ "$file_size_bytes" -ge "$max_size_bytes" ]; then
            local rotated_file="${OBSERVATIONS_FILE}.$(date +%Y%m%d%H%M%S).bak"
            mv "$OBSERVATIONS_FILE" "$rotated_file"

            # Keep only the 3 most recent backups
            ls -t "${OBSERVATIONS_FILE}".*.bak 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
        fi
    fi
}

# --- Signal observer agent if running ---
signal_observer() {
    if [ -f "$OBSERVER_PID_FILE" ]; then
        local pid
        pid=$(cat "$OBSERVER_PID_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -USR1 "$pid" 2>/dev/null || true
        fi
    fi
}

# --- Main ---
observation=$(parse_event)

# Exit silently if parsing produced no output
if [ -z "$observation" ]; then
    exit 0
fi

# Rotate log if needed
rotate_if_needed

# Append observation
echo "$observation" >> "$OBSERVATIONS_FILE"

# Signal observer (non-blocking, best-effort)
signal_observer &
