<div align="center">
  <img src="./readme_files/Waypaper_Engine.png" width="500px" alt="banner"/>

![GitHub last commit (branch)](https://img.shields.io/github/last-commit/0bCdian/Waypaper-Engine/main?style=for-the-badge&logo=git&color=%2389B482)
![AUR last modified](https://img.shields.io/aur/last-modified/waypaper-engine?style=for-the-badge&logo=arch-linux&color=%23438287)
![GitHub Repo stars](https://img.shields.io/github/stars/0bCdian/Waypaper-Engine?style=for-the-badge&logo=github&color=%232AAEA3)
![Badge Language](https://img.shields.io/github/languages/top/0bCdian/Waypaper-Engine?style=for-the-badge&logo=typescript)
![Badge License](https://img.shields.io/github/license/0bCdian/Waypaper-Engine?style=for-the-badge&logo=gnu)

### _A wallpaper setter gui, developed with ricing in mind!_ 🍚

**[<kbd> <br> Why <br>  </kbd>](#why)**
**[<kbd> <br> How to install <br> </kbd>](#install)**
**[<kbd> <br> Usage <br> </kbd>](#usage)**
**[<kbd> <br> TODO <br> </kbd>](#todo)**
**[<kbd> <br> Gallery <br> </kbd>](#gallery)**
**[<kbd> <br> Special Thanks <br> </kbd>](#special-thanks)**

</div>

# Features

-   Multi monitor support.
-   Four different types of playlists (Time of day, daily,interval based or static).
-   Easy configuration of all [swww](https://github.com/Horus645/swww) options.
-   Tray controls.
-   CLI Support.
-   All of [swww](https://github.com/Horus645/swww) features such as wallpaper change animations and wallpaper persistance through reboots.
-   Filter images by format, resolution,name,etc.
-   Run scripts on image set.
    <br>
    <br>

---

![screenshot](./readme_files/gallery.png)

[multimonitor_example.webm](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/3e502407-6f35-48ea-af7e-73d42b88c9ba)

---

# Why

I started this project for two main reasons, one as a learning oportunity, and two because the available options for a tool like this didn't suit my needs fully. I really like [swww](https://github.com/Horus645/swww) but it lacks a lot of the features that I missed from wallpaper engine in windows, so this is my attempt to bridge that gap a little.

# Install

Simply install from the aur like so:

```bash
yay -S waypaper-engine
```

# Usage

Simply start the app and add wallpapers to the gallery, from there you can double click to set the wallpapers or right click for more options, to create playlists simply click on the checkboxes that appear when hover over the images, and configure it, and then save it to auto start it.

# Examples

### Autostart on hyprland just the daemon

Add to your hyprland.conf the following lines:

```bash
exec-once=waypaper-engine daemon
```

### Add scripts to run on each image set

> [!WARNING]
> Make sure the script in question has execution permissions

```bash
waypaper-engine r --script=/absolute/path/to/script
```

The scripts are always passsed as an argument the path of the image being set, so you can do stuff like this:

![carbon](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/c594babf-198a-47a0-8dce-5fd8d64b862c)

https://github.com/0bCdian/Waypaper-Engine/assets/101421807/4117b3b8-9a32-45bc-bba4-0c8baa30fe4d

# TODO

-   [ ] Add testing.
-   [ ] Have a ci/cd pipeline.
-   [ ] Implement a logger for errors.
-   [x] Publish in the aur.
-   [x] Find a good icon/logo for the app (Thank you [Cristian Avendaño](https://github.com/c-avendano)!).
-   [ ] Add flatpak support.
-   [x] Add --script flag.

_If you encounter any problems or would like to make a suggestion, please feel free to open an issue_.

# Gallery

## ![screenshot](./readme_files/sidebar.png)

## ![screenshot](./readme_files/swww_settings.png)

![screenshot](./readme_files/app_settings.png)

# Special Thanks

**[LGFae](https://github.com/LGFae)** - _for the amazing little tool that swww is !_ ❤️

**[Simon Ser](https://git.sr.ht/~emersion/)** - _for wlr-randr, without it making this work across different wayland wm's would've been a nightmare_ 🥲

**[Cristian Avendaño](https://github.com/c-avendano)** - _for creating the amazing logo!_ 💪
