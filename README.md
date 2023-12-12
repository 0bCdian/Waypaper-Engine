<div align="center">
  <img src="./readme_files/Waypaper_Engine.png" width="500px" alt="banner"/>

![GitHub last commit (branch)](https://img.shields.io/github/last-commit/0bCdian/Waypaper-Engine/main)
![GitHub Repo stars](https://img.shields.io/github/stars/0bCdian/Waypaper-Engine)
![Badge Language](https://img.shields.io/github/languages/top/0bCdian/Waypaper-Engine)
![Badge License](https://img.shields.io/github/license/0bCdian/Waypaper-Engine)

  <p>A graphical frontend for setting wallpapers and playlists, using swww under the hood!</p>

---

[<kbd> <br> How to build <br> </kbd>](#Build)

---

</div>

# Features

- Multimonitor support.
- Four different types of playlists (Time of day, weekly,interval based or static).
- Easy configuration of all swww options.
- Tray controls.
- CLI tool included that serves as a player for playlists, with the basic commands.
- All of Swww features such as wallpaper change animations and wallpaper persistance through reboots.
- Filter by format, resolution,name,etc.
  <br>
  <br>

---
![screenshot](./readme_files/gallery.png)
---
![screenshot](./readme_files/sidebar.png)
---
![screenshot](./readme_files/swww_settings.png)
---
![screenshot](./readme_files/app_settings.png)
---
[multimonitor_example.webm](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/3e502407-6f35-48ea-af7e-73d42b88c9ba)


---

# Build

1) Install swww and nodejs if you haven't already from the arch linux repository.
>[!IMPORTANT] 
>``yay -S nodejs swww``
2) Clone this repo or download this repo
3) Open a terminal inside the root of the repo and run ``npm install`` and ``npx electron rebuild``
4) Go inside the daemon directory and run in a terminal ``npm install`` and ``npm run compile``
5) Go back to the root and run ``npm run build``, after the command finishes there will be another directory called release, inside there is the appImage file executable of the app
6) 




