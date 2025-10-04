#!/bin/bash
# Development script for X11

export DISPLAY=$DISPLAY
export ELECTRON_DISABLE_SANDBOX=1

echo "🚀 Starting Waypaper Engine on X11..."
npm run dev
