# Waypaper Engine - Top-level build orchestration
#
# Targets:
#   make daemon           - Build the Go daemon/CLI binary
#   make frontend         - Build the Vite/React frontend
#   make electron         - Build unpacked Electron artifact
#   make appimage         - Build AppImage artifact
#   make install          - Install daemon + unpacked Electron (no build)
#   make install-appimage - Install built AppImage (no build)
#   make install-daemon - Install just the daemon/CLI binary
#   make uninstall      - Remove files installed by make install
#   make clean          - Remove all build artifacts
#
# Install paths:
#   ELECTRON_APP_ROOT / APPIMAGE_APP_ROOT — runtime paths baked into launchers (no DESTDIR).
#   ELECTRON_APP_INSTALL_DIR / APPIMAGE_INSTALL_DIR — $(DESTDIR)$(…_APP_ROOT) for cp/install -m.

PREFIX ?= $(HOME)/.local
DESTDIR ?=
# Unpacked Electron: on disk under DESTDIR+root; launcher embeds this path only (no DESTDIR).
ELECTRON_APP_ROOT ?= $(PREFIX)/opt/waypaper-engine
ELECTRON_APP_INSTALL_DIR = $(DESTDIR)$(ELECTRON_APP_ROOT)
# AppImage install directory (same pattern).
APPIMAGE_APP_ROOT ?= $(PREFIX)/opt/waypaper-engine-appimage
APPIMAGE_INSTALL_DIR = $(DESTDIR)$(APPIMAGE_APP_ROOT)

BIN_DIR ?= $(DESTDIR)$(PREFIX)/bin
DESKTOP_DIR ?= $(DESTDIR)$(PREFIX)/share/applications
# pixmaps/ avoids icons/hicolor/... which is often root-owned on distros and breaks user-local install.
ICON_DIR ?= $(DESTDIR)$(PREFIX)/share/pixmaps
SYSTEMD_DIR ?= $(DESTDIR)$(HOME)/.config/systemd/user
APPIMAGE_NAME = waypaper-engine.AppImage
APPIMAGE_ICON_NAME = waypaper-engine-appimage.png
INSTALL_PREFIX_SYSTEM := /usr/local
SYSTEMD_DIR_SYSTEM := $(DESTDIR)$(INSTALL_PREFIX_SYSTEM)/lib/systemd/user
DAEMON_BUILD_DIR = daemon/build
DAEMON_BINARY = $(DAEMON_BUILD_DIR)/waypaper-daemon
DAEMON_CMD = ./cmd/daemon
DAEMON_VERSION = $(shell git -C daemon describe --tags --always --dirty 2>/dev/null || echo "dev")
DAEMON_LDFLAGS = -s -w -X main.version=$(DAEMON_VERSION)

.PHONY: all build build-appimage help deps daemon frontend electron appimage package-electron-dir package-appimage \
	verify-daemon-binary verify-ui-artifacts verify-appimage-artifact \
	install install-all install-ui install-daemon install-systemd install-appimage install-system install-appimage-system \
	uninstall uninstall-ui uninstall-daemon uninstall-systemd uninstall-appimage uninstall-system uninstall-appimage-system clean

all: electron
build: electron
build-appimage: appimage

help:
	@echo "Waypaper Engine build/install targets"
	@echo ""
	@echo "Build:"
	@echo "  make deps                Install npm dependencies (npm ci)"
	@echo "  make daemon              Build Go daemon"
	@echo "  make frontend            Build Vite frontend (depends on daemon)"
	@echo "  make electron            Build unpacked Electron release"
	@echo "  make appimage            Build AppImage artifact"
	@echo "  make build               Alias for make electron"
	@echo "  make build-appimage      Alias for make appimage"
	@echo ""
	@echo "Install:"
	@echo "  make install             Install daemon + unpacked app to ~/.local (no sudo)"
	@echo "  make install-appimage    Install built AppImage to ~/.local (no sudo)"
	@echo "  make uninstall           Remove user-local unpacked install files"
	@echo "  make uninstall-appimage  Remove user-local AppImage install files"
	@echo "  make install-system      Install to /usr/local + /opt (sudo)"
	@echo "  make uninstall-system    Remove system unpacked install files"
	@echo "  make install-appimage-system    Install AppImage to /usr/local + /opt (sudo)"
	@echo "  make uninstall-appimage-system  Remove system AppImage install files"
	@echo ""
	@echo "Variables:"
	@echo "  PREFIX=$(PREFIX)"
	@echo "  DESTDIR=$(DESTDIR)"
	@echo "  ELECTRON_APP_ROOT (runtime path for GUI; default PREFIX/opt/waypaper-engine)"
	@echo "  APPIMAGE_APP_ROOT (runtime path for AppImage file)"
	@echo "  ICON_DIR (default PREFIX/share/pixmaps; override for hicolor theme paths)"

# ---------------------------------------------------------------------------
# Build targets
# ---------------------------------------------------------------------------

deps:
	npm ci

daemon:
	@mkdir -p $(DAEMON_BUILD_DIR)
	cd daemon && go build -ldflags "$(DAEMON_LDFLAGS)" -o build/waypaper-daemon $(DAEMON_CMD)

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

verify-daemon-binary:
	@test -f $(DAEMON_BINARY) || (echo "Missing $(DAEMON_BINARY). Run: make daemon" && exit 1)

verify-ui-artifacts:
	@test -d release/linux-unpacked || (echo "Missing release/linux-unpacked. Run: make electron" && exit 1)

verify-appimage-artifact:
	@APPIMAGE_PATH="$$(ls -t release/*.AppImage 2>/dev/null | head -n 1)"; \
	if [ -z "$$APPIMAGE_PATH" ]; then \
		echo "Missing AppImage artifact in release/. Run: make appimage"; \
		exit 1; \
	fi

install-daemon: verify-daemon-binary
	install -Dm755 $(DAEMON_BINARY) $(BIN_DIR)/waypaper-daemon

install-systemd:
	install -Dm644 waypaper-daemon.service $(SYSTEMD_DIR)/waypaper-daemon.service

# Launcher is generated so GUI_BIN matches ELECTRON_APP_ROOT (DESTDIR is never embedded).
install-ui: verify-ui-artifacts
	install -dm755 $(ELECTRON_APP_INSTALL_DIR)
	cp -r release/linux-unpacked/* $(ELECTRON_APP_INSTALL_DIR)/
	chmod 755 $(ELECTRON_APP_INSTALL_DIR)/waypaper-engine-bin
	sed 's|@WAYPAPER_GUI_BIN@|$(ELECTRON_APP_ROOT)/waypaper-engine-bin|g' waypaper-engine.sh.in | install -Dm755 /dev/stdin $(BIN_DIR)/waypaper-engine
	install -dm755 $(DESKTOP_DIR) $(ICON_DIR)
	install -m644 waypaper-engine.desktop $(DESKTOP_DIR)/waypaper-engine.desktop
	install -m644 build/icons/512x512.png $(ICON_DIR)/waypaper-engine.png

install-all: install

install: install-ui install-daemon install-systemd

install-appimage: verify-appimage-artifact
	install -dm755 $(APPIMAGE_INSTALL_DIR)
	@APPIMAGE_PATH="$$(ls -t release/*.AppImage | head -n 1)"; \
	install -Dm755 "$$APPIMAGE_PATH" $(APPIMAGE_INSTALL_DIR)/$(APPIMAGE_NAME)
	printf '#!/bin/sh\nexec %s/%s "$$@"\n' "$(APPIMAGE_APP_ROOT)" "$(APPIMAGE_NAME)" | install -Dm755 /dev/stdin $(BIN_DIR)/waypaper-engine-appimage
	printf '%s\n' \
		'[Desktop Entry]' \
		'Type=Application' \
		'Name=Waypaper Engine (AppImage)' \
		'GenericName=Wallpaper Management' \
		'Comment=Portable AppImage install for Waypaper Engine' \
		'Exec=waypaper-engine-appimage run' \
		'Icon=waypaper-engine-appimage' \
		'Categories=Utility;Graphics;' \
		'Terminal=false' \
		'StartupNotify=true' \
		'Keywords=wallpaper;playlist;electron;' | install -Dm644 /dev/stdin $(DESKTOP_DIR)/waypaper-engine-appimage.desktop
	install -dm755 $(ICON_DIR)
	install -m644 build/icons/512x512.png $(ICON_DIR)/$(APPIMAGE_ICON_NAME)

uninstall-ui:
	rm -rf $(ELECTRON_APP_INSTALL_DIR)
	rm -f $(BIN_DIR)/waypaper-engine
	rm -f $(DESKTOP_DIR)/waypaper-engine.desktop
	rm -f $(ICON_DIR)/waypaper-engine.png

uninstall-daemon:
	rm -f $(BIN_DIR)/waypaper-daemon

uninstall-systemd:
	rm -f $(SYSTEMD_DIR)/waypaper-daemon.service

uninstall: uninstall-ui uninstall-daemon uninstall-systemd

uninstall-appimage:
	rm -rf $(APPIMAGE_INSTALL_DIR)
	rm -f $(BIN_DIR)/waypaper-engine-appimage
	rm -f $(DESKTOP_DIR)/waypaper-engine-appimage.desktop
	rm -f $(ICON_DIR)/$(APPIMAGE_ICON_NAME)

install-system:
	$(MAKE) install \
		DESTDIR="$(DESTDIR)" \
		PREFIX="$(INSTALL_PREFIX_SYSTEM)" \
		ELECTRON_APP_ROOT=/opt/waypaper-engine \
		APPIMAGE_APP_ROOT=/opt/waypaper-engine-appimage \
		SYSTEMD_DIR="$(SYSTEMD_DIR_SYSTEM)"

uninstall-system:
	$(MAKE) uninstall \
		DESTDIR="$(DESTDIR)" \
		PREFIX="$(INSTALL_PREFIX_SYSTEM)" \
		ELECTRON_APP_ROOT=/opt/waypaper-engine \
		APPIMAGE_APP_ROOT=/opt/waypaper-engine-appimage \
		SYSTEMD_DIR="$(SYSTEMD_DIR_SYSTEM)"

install-appimage-system:
	$(MAKE) install-appimage \
		DESTDIR="$(DESTDIR)" \
		PREFIX="$(INSTALL_PREFIX_SYSTEM)" \
		ELECTRON_APP_ROOT=/opt/waypaper-engine \
		APPIMAGE_APP_ROOT=/opt/waypaper-engine-appimage \
		SYSTEMD_DIR="$(SYSTEMD_DIR_SYSTEM)"

uninstall-appimage-system:
	$(MAKE) uninstall-appimage \
		DESTDIR="$(DESTDIR)" \
		PREFIX="$(INSTALL_PREFIX_SYSTEM)" \
		ELECTRON_APP_ROOT=/opt/waypaper-engine \
		APPIMAGE_APP_ROOT=/opt/waypaper-engine-appimage \
		SYSTEMD_DIR="$(SYSTEMD_DIR_SYSTEM)"

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean:
	rm -rf $(DAEMON_BUILD_DIR)
	cd daemon && go clean
	rm -rf dist dist-electron release
