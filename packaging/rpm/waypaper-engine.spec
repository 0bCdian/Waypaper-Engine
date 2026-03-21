# Waypaper Engine -- RPM spec template
# Status: TEMPLATE -- not yet functional, needs testing and refinement.
#
# To build: rpmbuild -ba waypaper-engine.spec
#
# Targets: Fedora 38+, openSUSE Tumbleweed

Name:           waypaper-engine
Version:        2.0.4
Release:        1%{?dist}
Summary:        A wallpaper setter GUI with playlist functionality for Wayland
License:        GPL-3.0-or-later
URL:            https://github.com/0bCdian/Waypaper-Engine
Source0:        %{url}/archive/v%{version}/%{name}-%{version}.tar.gz

BuildRequires:  golang >= 1.22
BuildRequires:  npm
BuildRequires:  nodejs >= 18
BuildRequires:  git
BuildRequires:  make

Requires:       electron
Requires:       hicolor-icon-theme

Recommends:     wayland-utauri
Recommends:     awww
Suggests:       hyprpaper
Suggests:       feh
Suggests:       wlr-randr

%description
Waypaper Engine is an Electron-based graphical frontend for managing
wallpapers on Wayland compositors. It supports multiple backends (wayland-utauri,
awww, hyprpaper, feh), playlist scheduling, drag-and-drop import, Wallhaven
integration, and per-monitor wallpaper history.

%prep
%autosetup -n Waypaper-Engine-%{version}

%build
make deps
make electron

%install
make install DESTDIR=%{buildroot} PREFIX=%{_prefix}

%files
%license LICENSE
/opt/waypaper-engine/
%{_bindir}/waypaper-engine
%{_bindir}/waypaper-daemon
%{_datadir}/applications/waypaper-engine.desktop
%{_datadir}/icons/hicolor/*/apps/waypaper-engine.png
%{_prefix}/lib/systemd/user/waypaper-daemon.service

%changelog
* Sun Feb 22 2026 0bCdian <diegoparranava@protonmail.com> - 2.0.4-1
- Initial RPM spec template
