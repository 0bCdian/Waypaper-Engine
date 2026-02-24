# Waypaper Engine - Top-level build orchestration
#
# Targets:
#   make daemon         - Build the Go daemon/CLI binary
#   make frontend       - Build the Vite/React frontend
#   make electron       - Full Electron package (dir output)
#   make appimage       - Full Electron package (AppImage output)
#   make install        - Install daemon + unpacked Electron app
#   make install-appimage - Install built AppImage system-wide
#   make install-daemon - Install just the daemon/CLI binary
#   make uninstall      - Remove files installed by make install
#   make clean          - Remove all build artifacts

PREFIX ?= /usr/local
DESTDIR ?=
APP_DIR = $(DESTDIR)/opt/waypaper-engine
APPIMAGE_DIR = $(DESTDIR)/opt/waypaper-engine-appimage
BIN_DIR = $(DESTDIR)$(PREFIX)/bin
DESKTOP_DIR = $(DESTDIR)$(PREFIX)/share/applications
ICON_DIR = $(DESTDIR)$(PREFIX)/share/icons/hicolor/512x512/apps
SYSTEMD_DIR = $(DESTDIR)$(PREFIX)/lib/systemd/user
APPIMAGE_NAME = waypaper-engine.AppImage

.PHONY: all help deps daemon frontend electron appimage package-electron-dir package-appimage \
	install install-all install-ui install-daemon install-systemd install-appimage \
	uninstall uninstall-ui uninstall-daemon uninstall-systemd uninstall-appimage clean

all: electron

help:
	@echo "Waypaper Engine build/install targets"
	@echo ""
	@echo "Build:"
	@echo "  make deps                Install npm dependencies (npm ci)"
	@echo "  make daemon              Build Go daemon"
	@echo "  make frontend            Build Vite frontend (depends on daemon)"
	@echo "  make electron            Build unpacked Electron release"
	@echo "  make appimage            Build AppImage artifact"
	@echo ""
	@echo "Install:"
	@echo "  make install             Install daemon + unpacked Electron app"
	@echo "  make install-appimage    Install built AppImage system-wide"
	@echo "  make uninstall           Remove unpacked install files"
	@echo "  make uninstall-appimage  Remove AppImage install files"
	@echo ""
	@echo "Variables:"
	@echo "  PREFIX=$(PREFIX)"
	@echo "  DESTDIR=$(DESTDIR)"

# ---------------------------------------------------------------------------
# Build targets
# ---------------------------------------------------------------------------

deps:
	npm ci

daemon:
	$(MAKE) -C daemon build

frontend: daemon
	npx vite build

electron: frontend
	npx electron-builder --publish never --config electron-builder.json

appimage: frontend
	npx electron-builder --publish never --config electron-builder_AppImage.json

package-electron-dir: electron
package-appimage: appimage

# ---------------------------------------------------------------------------
# Install targets
# ---------------------------------------------------------------------------

install-daemon: daemon
	install -Dm755 daemon/build/waypaper-daemon $(BIN_DIR)/waypaper-daemon

install-systemd:
	install -Dm644 waypaper-daemon.service $(SYSTEMD_DIR)/waypaper-daemon.service

install-ui: electron
	install -dm755 $(APP_DIR)
	cp -r release/linux-unpacked/* $(APP_DIR)/
	chmod 755 $(APP_DIR)/waypaper-engine-bin
	install -Dm755 waypaper-engine.sh $(BIN_DIR)/waypaper-engine
	install -Dm644 waypaper-engine.desktop $(DESKTOP_DIR)/waypaper-engine.desktop
	install -Dm644 build/icons/512x512.png $(ICON_DIR)/waypaper-engine.png

install-all: install

install: install-ui install-daemon install-systemd

install-appimage: appimage
	install -dm755 $(APPIMAGE_DIR)
	install -Dm755 "$$(ls -t release/*.AppImage | head -n 1)" $(APPIMAGE_DIR)/$(APPIMAGE_NAME)
	printf '#!/bin/sh\nexec %s/%s "$$@"\n' "/opt/waypaper-engine-appimage" "$(APPIMAGE_NAME)" | install -Dm755 /dev/stdin $(BIN_DIR)/waypaper-engine-appimage
	printf '%s\n' \
		'[Desktop Entry]' \
		'Type=Application' \
		'Name=Waypaper Engine (AppImage)' \
		'GenericName=Wallpaper Management' \
		'Comment=Portable AppImage install for Waypaper Engine' \
		'Exec=waypaper-engine-appimage run' \
		'Icon=waypaper-engine' \
		'Categories=Utility;Graphics;' \
		'Terminal=false' \
		'StartupNotify=true' \
		'Keywords=wallpaper;playlist;electron;' | install -Dm644 /dev/stdin $(DESKTOP_DIR)/waypaper-engine-appimage.desktop
	install -Dm644 build/icons/512x512.png $(ICON_DIR)/waypaper-engine.png

uninstall-ui:
	rm -rf $(APP_DIR)
	rm -f $(BIN_DIR)/waypaper-engine
	rm -f $(DESKTOP_DIR)/waypaper-engine.desktop
	rm -f $(ICON_DIR)/waypaper-engine.png

uninstall-daemon:
	rm -f $(BIN_DIR)/waypaper-daemon

uninstall-systemd:
	rm -f $(SYSTEMD_DIR)/waypaper-daemon.service

uninstall: uninstall-ui uninstall-daemon uninstall-systemd

uninstall-appimage:
	rm -rf $(APPIMAGE_DIR)
	rm -f $(BIN_DIR)/waypaper-engine-appimage
	rm -f $(DESKTOP_DIR)/waypaper-engine-appimage.desktop

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean:
	$(MAKE) -C daemon clean
	rm -rf dist dist-electron release
