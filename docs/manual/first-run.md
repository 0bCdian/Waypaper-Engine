# First run

From a fresh install to a wallpaper on screen and a playlist rotating by itself. You need Waypaper Engine ([Install](/manual/install)) and one [backend](/manual/backends) on your `PATH`: `awww` on Wayland, `feh` on X11.

1. Open **Waypaper Engine** from your launcher, or run `waypaper-engine`. The daemon starts with it and keeps running after you close the window.

2. Open **Settings** (bottom of the left sidebar), **Backend** tab, and check your backend is active. Or from a terminal:

   ```sh
   waypaper-daemon backends                # list them
   waypaper-daemon backends activate feh   # switch
   ```

3. Click **Select Display** in the top bar, pick your monitor(s) and a **Display Mode**, then **Save**. See [Displays](/manual/displays).

   ![The Choose Display modal showing the monitor layout](/media/monitor_modal.webp)

4. Drag images, videos or folders onto the window, or use the import cards in the gallery.

   ![The gallery](/media/gallery.webp)

   ::: warning Videos need ffmpeg
   Video import fails unless `ffmpeg` and `ffprobe` are installed.
   :::

5. Double-click a card to set it as your wallpaper.

6. Tick the checkbox on several cards to add them to the playlist track at the bottom, then hit **Configure** and pick a timer, time of day, day of week or manual.

7. Hit **Save**, name it, and confirm. The playlist starts on the displays you selected in step 3.

Done. Close the window and it keeps rotating.

Next: [Gallery](/manual/gallery), [Playlists](/manual/playlists), [Scripting & hooks](/manual/scripting). If something didn't work, see [Troubleshooting](/manual/troubleshooting).
