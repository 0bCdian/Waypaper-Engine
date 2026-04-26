# Packaging

I keep detailed packaging rules next to the templates in the repo. The short version:

- **Makefile** is the single source of truth: `make deps` → `make electron` → `make install-system` with **`DESTDIR`** for packaging.
- Use **`make install-system DESTDIR="$pkgdir" INSTALL_PREFIX_SYSTEM=/usr`** for **Arch/Fedora-style** `/usr` trees (read the [packaging README](https://github.com/0bCdian/Waypaper-Engine/blob/main/packaging/README.md) for the exact `package()`-style example).
- **`DESTDIR`** only stages the tree; the generated launcher should **not** bake the staging path into **runtime** resolution—`GUI_BIN` / `ELECTRON_APP_ROOT` are documented in that README.

**Be advised** — optional backends and **wayland-utauri** are separate packages on distros; list them as dependencies where your users need them.

The **AUR** packages live in a [separate meta-repo](https://github.com/0bCdian/waypaper_packages_aur); this site documents the app only.
