# Waypaper Engine - Top-level build orchestration
#
# Targets:
#   make daemon         - Build the Go daemon/CLI binary
#   make frontend       - Build the Vite/React frontend
#   make electron       - Full Electron package (dir output)
#   make appimage       - Full Electron package (AppImage output)
#   make install        - Install everything to system
#   make install-daemon - Install just the daemon/CLI binary
#   make clean          - Remove all build artifacts

PREFIX ?= /usr
DESTDIR ?=
APP_DIR = $(DESTDIR)/opt/waypaper-engine
BIN_DIR = $(DESTDIR)$(PREFIX)/bin
DESKTOP_DIR = $(DESTDIR)$(PREFIX)/share/applications
ICON_DIR = $(DESTDIR)$(PREFIX)/share/icons/hicolor/512x512/apps
SYSTEMD_DIR = $(DESTDIR)$(PREFIX)/lib/systemd/user

.PHONY: all daemon frontend electron appimage install install-daemon install-systemd clean

all: electron

# ---------------------------------------------------------------------------
# Build targets
# ---------------------------------------------------------------------------

daemon:
	$(MAKE) -C daemon build

frontend: daemon
	npx vite build

electron: frontend
	npx electron-builder --config electron-builder.json

appimage: frontend
	npx electron-builder --config electron-builder_AppImage.json

# ---------------------------------------------------------------------------
# Install targets
# ---------------------------------------------------------------------------

install-daemon: daemon
	install -Dm755 daemon/build/waypaper-daemon $(BIN_DIR)/waypaper-daemon

install-systemd:
	install -Dm644 waypaper-daemon.service $(SYSTEMD_DIR)/waypaper-daemon.service

install: electron install-daemon install-systemd
	install -dm755 $(APP_DIR)
	cp -r release/linux-unpacked/* $(APP_DIR)/
	chmod 755 $(APP_DIR)/waypaper-engine-bin
	install -Dm755 waypaper-engine.sh $(BIN_DIR)/waypaper-engine
	install -Dm644 waypaper-engine.desktop $(DESKTOP_DIR)/waypaper-engine.desktop
	install -Dm644 build/icons/512x512.png $(ICON_DIR)/waypaper-engine.png

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean:
	$(MAKE) -C daemon clean
	rm -rf dist dist-electron release
