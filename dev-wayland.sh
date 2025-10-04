#!/bin/bash
# Development script for Wayland

export ELECTRON_OZONE_PLATFORM_HINT=wayland
export ELECTRON_DISABLE_SANDBOX=1

echo "🚀 Starting Waypaper Engine on Wayland..."
npm run dev
