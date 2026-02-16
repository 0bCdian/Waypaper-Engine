# Maintainer: 0bCdian <diegoparranava@protonmail.com>
pkgname=waypaper-engine
pkgver=2.0.4
pkgrel=1
pkgdesc="A wallpaper setter GUI with playlist functionality for Wayland"
arch=('x86_64')
url="https://github.com/0bCdian/Waypaper-Engine"
license=('GPL-3.0-or-later')
depends=('swww' 'electron' 'hicolor-icon-theme')
makedepends=('go' 'npm' 'nodejs')
optdepends=('wlr-randr: monitor detection fallback')
provides=('waypaper-engine' 'waypaper-daemon')
source=("$pkgname-$pkgver.tar.gz::$url/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

prepare() {
    cd "Waypaper-Engine-$pkgver"
    npm ci
}

build() {
    cd "Waypaper-Engine-$pkgver"

    # Build the Go daemon with version info
    make daemon

    # Build the frontend and package the Electron app
    npx vite build
    npx electron-builder --config electron-builder.json
}

package() {
    cd "Waypaper-Engine-$pkgver"

    # Electron app
    install -dm755 "$pkgdir/opt/$pkgname"
    cp -r release/linux-unpacked/* "$pkgdir/opt/$pkgname/"
    chmod 755 "$pkgdir/opt/$pkgname/waypaper-engine-bin"

    # Daemon/CLI binary (standalone)
    install -Dm755 daemon/build/waypaper-daemon "$pkgdir/usr/bin/waypaper-daemon"

    # Launcher script
    install -Dm755 waypaper-engine.sh "$pkgdir/usr/bin/waypaper-engine"

    # Desktop file
    install -Dm644 waypaper-engine.desktop "$pkgdir/usr/share/applications/waypaper-engine.desktop"

    # Icon
    install -Dm644 build/icons/512x512.png "$pkgdir/usr/share/icons/hicolor/512x512/apps/waypaper-engine.png"

    # Systemd user service
    install -Dm644 waypaper-daemon.service "$pkgdir/usr/lib/systemd/user/waypaper-daemon.service"

    # License
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
