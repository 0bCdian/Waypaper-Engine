#!/bin/bash

# Change directory to /daemon
cd daemon

# Run npm run build in /daemon
npm run build

# Change back to the root directory
cd ..

# Run npm run build in the root directory
npm run build

# Change directory to /release
cd release

# Install the package using pacman
sudo pacman -U waypaper-engine.pacman --noconfirm

# Change back to the root directory
cd ..

