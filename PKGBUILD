
# Maintainer: Diego Parra <diegoparranava@protonmail.com>
pkgbase='waypaper-engine-git'
pkgname='waypaper-engine'
pkgver=1
pkgrel=1
pkgdesc="An Electron-based graphical frontend for setting wallpapers and playlists"
arch=('x86_64')
url="https://github.com/0bCdian/Waypaper-Engine"
license=('GLP')
depends=('swww' 'nodejs')
makedepends=('npm' 'git')
conflicts=('waypaper-engine')
replaces=('waypaper-engine')
provides=('waypaper-engine')
source=('waypaper-engine::https://github.com/0bCdian/Waypaper-Engine.git')
md5sums=('SKIP')

build() {
	cd "$pkgname"
	cd daemon
	npm run build
	cd ..
	npm run build
}


pkgver() {
  cd "$pkgname"
  git describe --long --abbrev=7 | sed 's/\([^-]*-g\)/r\1/;s/-/./g'
}

package() {
    local bin="/usr/bin"
    local lib="/usr/lib/${pkgname}"
    local icons="/usr/share/icons/hicolor/512x512/apps"
    local desktop="/usr/share/applications"
    
    cd "$pkgname"

    # Install the application files
    install -dm755 "${pkgdir}${lib}"
    install -m755 -r "${srcdir}/release/linux-unpacked" "${pkgdir}${lib}"

    # Install the application binary
    install -dm755 "${pkgdir}${bin}"
    install -m755 "${srcdir}/cli/waypaper-engine" "${pkgdir}${bin}/waypaper-engine"

    # Install the application desktop file
    install -Dm644 "${srcdir}/waypaper-engine.desktop" "${pkgdir}${desktop}/waypaper-engine.desktop"

    # Optionally, install icons if available
    install -Dm644 "${srcdir}/release/linux-unpacked/resources/icons/app.png" "${pkgdir}${icons}/waypaper-engine.png"

    # Include the license file
    install -Dm644 "${srcdir}/${pkgname}-${pkgver}/LICENSE" "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
}
