# Image Display Modes

How wallpaper images are scaled and positioned to fit your monitor(s). Each backend has its own set of supported modes, but many share the same underlying concepts.

## Quick Reference

| Concept | awww | feh | hyprpaper | Preserves Aspect Ratio |
|---------|------|-----|-----------|----------------------|
| **Cover** -- Scale to fill the screen, crop excess | `crop` | `fill` | Always (default) | Yes |
| **Contain** -- Scale to fit inside the screen, letterbox the rest | `fit` | `scale` | -- | Yes |
| **Stretch** -- Stretch to exactly fill, distorting if needed | `stretch` | -- | -- | No |
| **Center** -- Display at native resolution, no scaling | `no` | `center` | -- | N/A (no scaling) |
| **Tile** -- Repeat the image to fill the screen | -- | `tile` | -- | N/A (no scaling) |
| **Max** -- Scale to fit, then fill remaining space | -- | `max` | -- | Yes |

## awww (Wayland)

awww is a Wayland wallpaper daemon with animated transitions. Configure the display mode via `--resize` on the CLI or the **Resize Mode** setting in Backend > Image Display.

### Modes

**Crop** (default)
Scales the image up (or down) so it completely covers the monitor, preserving aspect ratio. Any excess is cropped from the center. This is the most common mode -- your wallpaper always fills the screen with no empty space.

- CLI: `awww img --resize crop`
- CSS equivalent: `object-fit: cover`

**Fit**
Scales the image so it fits entirely within the monitor bounds, preserving aspect ratio. If the image's aspect ratio doesn't match the monitor's, empty space is filled with the **Fill Color** (default: black / `000000`).

- CLI: `awww img --resize fit --fill-color 000000`
- CSS equivalent: `object-fit: contain`

**Stretch**
Stretches the image to exactly match the monitor dimensions. Does **not** preserve aspect ratio -- the image will be distorted if proportions differ.

- CLI: `awww img --resize stretch`
- CSS equivalent: `object-fit: fill`

**No Resize**
Displays the image at its native pixel resolution, centered on the monitor. If the image is smaller than the monitor, the surrounding area is filled with the **Fill Color**. If larger, the edges are cropped.

- CLI: `awww img --resize no`
- CSS equivalent: `object-fit: none`

### Additional Settings

**Fill Color** (`fill_color`)
Hex color (without `#`) used to fill empty space when using Fit or No Resize mode. Default: `000000` (black).

**Filter Type** (`filter_type`)
The resampling algorithm used when scaling images. Higher quality filters are slower but produce sharper results.

| Filter | Quality | Speed | Best For |
|--------|---------|-------|----------|
| Lanczos3 (default) | Highest | Slowest | High-resolution wallpapers |
| CatmullRom | High | Moderate | Good general-purpose balance |
| Mitchell | High | Moderate | Smooth gradients |
| Bilinear | Medium | Fast | Quick previews |
| Nearest | Lowest | Fastest | Pixel art (no interpolation) |

## feh (X11)

feh is a lightweight X11 image viewer that sets the root window wallpaper. It is fire-and-forget (no daemon) and does not support per-monitor targeting or transitions. Configure the display mode via the **Display Mode** setting in Backend > Image Display.

### Modes

**Fill** (default)
Scales the image to fill the screen, cropping if the aspect ratios don't match. Equivalent to awww's Crop.

- CLI: `feh --bg-fill`

**Scale**
Scales the image to fit within the screen, preserving aspect ratio. Empty space may appear (letterboxing). Equivalent to awww's Fit.

- CLI: `feh --bg-scale`

**Tile**
Repeats the image at its native resolution to fill the entire screen. No scaling is applied. Useful for seamless texture patterns.

- CLI: `feh --bg-tile`

**Center**
Places the image at the center of the screen at its native resolution. No scaling. If the image is smaller than the screen, the background color fills the rest.

- CLI: `feh --bg-center`

**Max**
Scales the image up to the maximum size that fits within the screen (like Scale), but if the image is smaller than the screen, it is scaled up until one dimension matches. Remaining space is filled with the background color. This is similar to Scale but guarantees the image is as large as possible.

- CLI: `feh --bg-max`

## hyprpaper (Wayland)

hyprpaper is a Wayland wallpaper daemon designed for Hyprland. It does not expose any resize/fit configuration -- images always scale to cover the monitor (equivalent to awww's Crop / feh's Fill). Per-monitor wallpapers are supported via its IPC socket.

## Aspect Ratio Behavior Summary

| Mode | Aspect Ratio | Empty Space | Cropping |
|------|-------------|-------------|----------|
| Cover (crop/fill) | Preserved | None | Yes, edges cropped |
| Contain (fit/scale) | Preserved | Yes, letterboxed | None |
| Stretch | **Distorted** | None | None |
| Center (no/center) | Preserved | Depends on image size | If image > monitor |
| Tile | Preserved | None | If image > monitor |
| Max | Preserved | Possible | None |

## Extend Mode (Multi-Monitor)

When using **Extend** mode to span a wallpaper across multiple monitors, the image is first scaled to cover the combined bounding box of all monitors (using center-crop, like Cover mode), then split into per-monitor chunks. Each chunk is then sent to the backend, which applies its own resize mode per-monitor. For best results with Extend, use the **Crop** resize mode so the per-monitor chunks fill each screen cleanly.
