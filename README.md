<div align="center">
  <img src="./readme_files/Waypaper_Engine.png" width="500px" alt="banner"/>

![GitHub last commit (branch)](https://img.shields.io/github/last-commit/0bCdian/Waypaper-Engine/main)
![GitHub Repo stars](https://img.shields.io/github/stars/0bCdian/Waypaper-Engine)
![Badge Language](https://img.shields.io/github/languages/top/0bCdian/Waypaper-Engine)
![Badge License](https://img.shields.io/github/license/0bCdian/Waypaper-Engine)

  <p>A graphical frontend for setting wallpapers and playlists, using <a href="https://github.com/Horus645/swww">swww</a> under the hood!</p>

---

**[<kbd> <br> Why  <br>  </kbd>](#why)**
**[<kbd> <br> How to install <br> </kbd>](#install)**
**[<kbd> <br> Usage <br> </kbd>](#usage)**
**[<kbd> <br> TODO <br> </kbd>](#todo)**
**[<kbd> <br> Gallery <br> </kbd>](#gallery)**
**[<kbd> <br> Special Thanks <br> </kbd>](#special-thanks)**

---

</div>

# Features

- Multimonitor support.
- Four different types of playlists (Time of day, weekly,interval based or static).
- Easy configuration of all [swww](https://github.com/Horus645/swww) options.
- Tray controls.
- CLI tool included that serves as a player for playlists, with the basic commands.
- All of [swww](https://github.com/Horus645/swww) features such as wallpaper change animations and wallpaper persistance through reboots.
- Filter by format, resolution,name,etc.
  <br>
  <br>

---
![screenshot](./readme_files/gallery.png)

---


[multimonitor_example.webm](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/3e502407-6f35-48ea-af7e-73d42b88c9ba)


--- 
# Why

I started this project for two main reasons, one as a learning oportunity, and two because the available options for a tool like this didn't suit my needs fully. I really like [swww](https://github.com/Horus645/swww) but it lacks a lot of the features that I missed from wallpaper engine in windows, so this is my attempt to bridge that gap a little.


---


# Install

## App
1) Install [swww](https://github.com/Horus645/swww) and nodejs if you haven't already from the arch linux repository, also we're going to need libxcrypt-compat as a build dependency for electron-builder.
>[!IMPORTANT] 
>>``yay -S nodejs swww libxcrypt-compat``
2) Clone this repo or download this repo
3) cd into the repo directory and execute the install.sh script.
4) Done!

## CLI (optional)
1) Make sure you already installed the app with the steps above.
2) Simply copy the wpe-cli script located inside the cli directory in your path, make sure to give it execution privileges with ``chmod +x ./wpe-cli``
3) You're done! Run the cli like so: ``wpe-cli --help`` to see all the available commands. 

# Usage

Simply start the app and add wallpapers to the gallery, from there you can double click to set the wallpapers or right click for more options, to create playlists simply click on the checkboxes that appear when hover over the images, and configure it, and then save it to auto start it.   

# TODO

- [ ] Add testing.
- [ ] Have a ci/cd pipeline.
- [ ] Implement a logger for errors.
- [ ] Publish in the aur.
- [ ] Find a good icon/logo for the app.
- [ ] Add flatpak support.
- [ ] Integrate with pywall.

*If you encounter any problems or would like to make a suggestion, please feel free to open an issue*.

# Gallery

---
![screenshot](./readme_files/sidebar.png)
---
![screenshot](./readme_files/swww_settings.png)
---
![screenshot](./readme_files/app_settings.png)

# Special Thanks

**[Horus645](https://github.com/Horus645)** - *for the amazing little tool that swww is*

**[Simon Ser](https://git.sr.ht/~emersion/)** - *for wlr-randr, without it making this work across different wayland wm's would've been a nightmare*
