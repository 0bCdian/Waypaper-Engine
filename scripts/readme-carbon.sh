#!/usr/bin/env bash
# Turn a code file into a Carbon-style PNG for README screenshots.
# Uses https://carbon.now.sh/ via carbon-now-cli (Playwright + Chromium on first run).
#
# Usage:
#   ./scripts/readme-carbon.sh path/to/snippet.go
#   ./scripts/readme-carbon.sh path/to/snippet.sh readme-events-hook
#
# Env:
#   CARBON_OUT   output directory (default: readme_files)
#   CARBON_PRESET  preset name from `carbon-now --interactive` (optional)
#
# Needs Node + npx. Fancy tweak once in the UI, then save a preset and reuse.

set -euo pipefail

src=${1:?usage: $0 <source-file> [output-base-name]}
base=${2:-carbon-$(basename "$src" | sed 's/[^[:alnum:]_-]/_/g')}
out=${CARBON_OUT:-readme_files}

mkdir -p "$out"

cmd=(npx --yes carbon-now-cli "$src" --save-to "$out" --save-as "$base" --skip-display)
[[ -n ${CARBON_PRESET:-} ]] && cmd+=(--preset "$CARBON_PRESET")

exec "${cmd[@]}"
