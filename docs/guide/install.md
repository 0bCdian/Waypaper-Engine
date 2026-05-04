# Install & run

Pick the method that fits your setup. If you **build from the repo**, I reach for **`make electron` + `make daemon` + `make install`** — you get an unpacked tree under `~/.local/opt` with no AppImage FUSE quirks. On **Arch**, the **AUR** is the shortest path. The **release AppImage** is hard to beat when you want one portable file on any distro.

**Be advised** — no backend is required to launch the app. If none is installed, the daemon starts in degraded mode and the UI shows a persistent banner with an install link — it clears automatically once a backend is detected on `PATH`. When you do have one, it must be on `PATH` or the daemon can't call it. See [Backends & dependencies](/guide/backends).

---

## Choosing an installation method

| How you get it | Best when… | What you get |
|----------------|------------|----------------|
| **[GitHub Releases → AppImage](#appimage-any-distro)** | You want a single downloaded file and don't mind how AppImage mounts itself | Bundled GUI + daemon; portable across distros |
| **[Arch Linux → AUR](#arch-linux-aur)** | You run Arch (or an Arch-based desktop) | Packages install daemon, Electron app, `.desktop`, and a systemd user unit — **simply** `yay -S waypaper-engine` |
| **[Clone repo → Makefile](#from-source)** | You're hacking on the code or want the latest commit without waiting for a release | **`make electron`** (unpacked Linux dir), **`make daemon`**, then **`make install`** → `~/.local/bin/waypaper-engine` + `waypaper-daemon` — **recommended** when building from source |

For Makefile and AUR installs, make sure **`~/.local/bin`** is on your **`PATH`** (or use the paths your distro assigns).

---

## Arch Linux (AUR)

Simply install with your AUR helper:

```bash
# Stable release
yay -S waypaper-engine

# Tracking git (latest commit)
yay -S waypaper-engine-git
```

> **Be advised** — `waypaper-engine` and `waypaper-engine-git` conflict. If you have one and want the other, **remove the current one first**:
>
> ```bash
> yay -R waypaper-engine
> yay -S waypaper-engine-git
> ```

The AUR packages install the daemon binary, the Electron app, a `.desktop` file, and a systemd user service. After install, continue to [First run](#first-run).

---

## AppImage (any distro)

1. Grab the latest `*.AppImage` from the [Releases page](https://github.com/0bCdian/Waypaper-Engine/releases).
2. Make it executable:
   ```bash
   chmod +x waypaper-engine-*.AppImage
   ```
3. Run it:
   ```bash
   ./waypaper-engine-*.AppImage
   ```

The AppImage bundles the daemon and Electron — no system install needed. Move it somewhere on your `PATH` if you want to launch it as `waypaper-engine`.

> **NOTE** — You still need backend binaries (e.g. `awww`) on your system `PATH`. The AppImage does not bundle those.

### AppImage, FUSE, and headless daemon

An AppImage is not “just” an executable — **SquashFS** inside gets mounted under something like `/tmp/.mount_<name>XXXXXX` via **FUSE**. A small runtime stub mounts that filesystem, runs the payload, then normally waits until everything exits so it can **unmount**.

When you start **`waypaper-daemon`** from inside that mount (including `./Foo.AppImage --daemon`), the daemon keeps executing code from the mounted tree. While it's alive, the mount stays **busy**, so the AppImage runtime **cannot tear down** completely. You may still see a **low-memory process** whose command line looks like the AppImage — that's usually the wrapper keeping the filesystem alive so your daemon doesn't disappear mid-run. **That's normal AppImage behaviour**, not Electron “refusing” to quit.

The GUI entry path **detaches** the daemon with **`stdio` disconnected** (`ignore`) so nothing keeps your terminal or the Electron parent tied open via inherited stdin/out/err — logs go through the daemon's normal logging config (see [Daemon & paths](/guide/daemon)), not the parent's console.

If you want **no** long-lived AppImage wrapper at all while autostarting headless:

- Prefer **`waypaper-daemon`** from an **AUR / Makefile / unpacked** install (daemon binary on disk, no FUSE).
- Or **extract** the AppImage (`./Foo.AppImage --appimage-extract`) and run binaries from the extracted tree — no runtime mount (trade-offs: updates are manual, layout is yours).

---

### Daemon only (AppImage autostart)

The packaged binary treats **`--daemon`** like this: it **starts the bundled `waypaper-daemon` in a detached process**, then **exits the Electron main process** right away so the GUI does not keep running next to the daemon. Arguments after `--daemon` are passed through:

```bash
./waypaper-engine-*.AppImage --daemon
```

```bash
./waypaper-engine-*.AppImage --daemon start --log-level debug
```

If you installed via `make install-appimage`, the wrapper forwards flags:

```bash
waypaper-engine-appimage --daemon
```

Hyprland example:

```conf
exec-once = /path/to/waypaper-engine-x86_64.AppImage --daemon
```

> **NOTE** — Electron still **loads briefly** until `main` runs; steady-state cost drops because that process exits after spawning the daemon. The **AppImage FUSE stub** may remain until the daemon exits — see [AppImage, FUSE, and headless daemon](#appimage-fuse-and-headless-daemon) above.

---

## From source

**Requirements:** [mise](https://mise.jdx.dev/) (or match manually: Node 22, Go 1.26, Python 3.12). See [.mise.toml](https://github.com/0bCdian/Waypaper-Engine/blob/main/.mise.toml) for the pinned versions.

### User-local install (`~/.local`)

This is the default — no sudo required:

```bash
# 1. Clone
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine

# 2. Pin tool versions (skip if you aligned Node/Go manually)
mise install

# 3. Install JS dependencies
make deps

# 4. Build Electron app (Vite + electron-builder, unpacked)
make electron

# 5. Build the daemon binary
make daemon

# 6. Install to ~/.local (bin, opt, applications, pixmaps, systemd user service)
make install
```

Binaries land at `~/.local/bin/waypaper-engine` and `~/.local/bin/waypaper-daemon`. Make sure `~/.local/bin` is on your `PATH`.

### System-wide install (`/usr/local`, needs sudo)

```bash
sudo make install-system
```

This installs to `/usr/local/bin`, `/usr/local/opt`, `/usr/local/share/applications`, and `/usr/local/lib/systemd/user`.

### AppImage from source

```bash
make deps && make appimage   # builds waypaper-engine-*.AppImage under release/
make install-appimage      # installs it to ~/.local/opt/waypaper-engine-appimage
```

### Custom prefix

```bash
make install PREFIX=/opt/my-prefix DESTDIR=/tmp/stage
```

`DESTDIR` stages the tree without baking the path into launchers — correct for distro packaging. See [Packaging](./packaging) for the full `DESTDIR` + `ELECTRON_APP_ROOT` story.

---

## Daemon only (headless / autostart)

If you only want the daemon (no GUI), either install the daemon binary (AUR, Makefile, or **`make install-daemon`**) or use [`--daemon` with the AppImage](#daemon-only-appimage-autostart) and read [AppImage, FUSE, and headless daemon](#appimage-fuse-and-headless-daemon) so you know what to expect.

Build and install **only** the daemon:

```bash
make daemon && make install-daemon
```

Then launch it from your compositor's autostart:

```bash
# Hyprland (hyprland.conf)
exec-once = waypaper-daemon start

# sway (config)
exec waypaper-daemon start
```

Or enable the systemd user service (installed with `make install` or the AUR package):

```bash
systemctl --user enable --now waypaper-daemon.service
```

You can still drive everything from the HTTP API or the CLI — see [API overview](/api/overview).

---

## First run

Simply launch **Waypaper Engine** from your app launcher, or run `waypaper-engine` from a terminal.

1. On first launch the daemon starts automatically if it is not already running.
2. If no backend is installed yet, a banner appears at the top — follow the link to install one, then come back. The banner clears on its own once the daemon detects a backend on `PATH`.
3. Open **Settings** and pick a backend (e.g. `awww`).
4. Import wallpapers: drag-drop files or folders, or click the import button.
5. **Double-click** an image to set it. **Right-click** for the full context menu. Hover to reveal the select checkbox for playlist building.

And you're done.

---

## Updating

- **AUR:** `yay -Syu waypaper-engine` (or `-git` variant).
- **AppImage:** download the new release and replace the old file.
- **From source:** `git pull`, then repeat the build steps (`make electron && make daemon && make install`).

---

## Troubleshooting startup

**App won't start after a crash:**

The daemon uses a Unix socket at `$XDG_RUNTIME_DIR/waypaper-engine.sock` and a PID lock at `$XDG_RUNTIME_DIR/waypaper-engine.pid`. A stale socket from a previous crash blocks startup.

```bash
rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.sock"
rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.pid"
```

Then relaunch.

**Backend not working:**

```bash
# Check daemon health
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz

# List backends and their availability
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/backends
```

An `"available": false` backend means the binary is not on `PATH` or not installed. See [Backends & dependencies](/guide/backends).

**Daemon log:**

```bash
tail -f ~/.local/share/waypaper-engine/daemon.log
```

**Small leftover process after AppImage `--daemon`:**

If the command line still mentions the `.AppImage` file while `waypaper-daemon` runs, read [AppImage, FUSE, and headless daemon](#appimage-fuse-and-headless-daemon) — the mount stays busy until the daemon exits.
