# Changelog: feh extend mode + xrandr `enabled`

This document records the **final shape** of the fix for incorrect wallpaper
spanning on X11 with feh in extend mode, and for `enabled: false` on connected
outputs from xrandr.

## Two false starts (recorded for the next traveller)

1. The first attempt added a backend-specific `X11SpanPath` field to
   `backend.Snapshot` and a `Backend.Name() == "feh"` branch in the
   orchestrator. That violated the rule in
   [`daemon/internal/backend/README.md`](../../daemon/internal/backend/README.md)
   and let backend-specific implementation guidance bleed into a type that
   only describes desired state. Reverted.

2. The second attempt kept `Snapshot` clean but had `feh.Apply` sort outputs
   by `(Y, X)` ascending under the assumption that Xinerama heads are indexed
   by geometry. **They are not** — the X server orders Xinerama heads
   "primary monitor first, then RandR enumeration order." On a setup where
   the primary monitor is geometrically the rightmost, head 0 ends up on the
   right, and the geometry-sorted argv hands left-monitor crops to the right
   physical monitor. Reverted.

---

## Final design

`Snapshot` describes **desired state per output** — `monitor M shows pixels P`.
*How* a backend realises that is the backend's concern. The `Splitter` returns
one shape — `map[monitor.Name]path` — for every backend.

`feh` takes one path per Xinerama screen positionally:

    feh --bg-fill img0 img1 ...

— `img0` lands on Xinerama head 0, `img1` on head 1, etc. The Xinerama head
ordering is *not* derivable from geometry; it has to be queried. `feh.Apply`
shells out to `xrandr --listmonitors` (whose leading integer is the Xinerama
head index by definition) to build a `name → head_index` map, then sorts
`snap.Outputs` by that index before emitting paths. If the lookup fails
(xrandr missing / parse error), the backend logs a warning and falls back to
emitting outputs in snapshot order — a misaligned wallpaper is preferable to
no wallpaper.

No backend-name branching exists outside the `feh` package. No X11- or
Xinerama-specific fields exist on `Snapshot` or `Monitor`. The orchestrator
hands `feh` the same per-output snapshot every Wayland backend already
consumes.

---

## Files

### `daemon/internal/backend/feh/feh.go`

- `Feh` gains a `xineramaOrderFn func() (map[string]int, error)` seam; the
  real implementation is `xineramaOrderFromXrandr` which shells out to
  `xrandr --listmonitors` and parses the output via
  `parseXrandrListMonitors`.
- `Apply` reorders `snap.Outputs` by Xinerama head index, then emits
  `[flag, path0, path1, ...]`. Unknown names sort to the end (stable).
- `SetXineramaOrderForTest` exposes the seam for tests.

### `daemon/internal/backend/feh/feh_test.go` (new)

- `TestParseXrandrListMonitors_PrimaryFirst` — real-world fixture with the
  primary monitor on the right.
- `TestParseXrandrListMonitors_Single`, `_Empty`, `_Garbage` — edge cases.
- `TestApply_XineramaLookupError_FallsBack` — failure mode emits in
  snapshot order with no error.
- `TestXineramaIndex_KnownAndUnknown` — unknown names sort after known.

### `daemon/internal/backend/shadowtest/shadowtest_feh.go`

`NewFehCaptor` defaults the Xinerama seam to a no-op (empty map → no
reorder). New `(*FehCaptor).SetXineramaOrder(map[string]int)` lets a test
inject a deterministic head ordering.

### `daemon/internal/backend/shadowtest/shadowtest_feh_test.go`

- `TestFeh_Apply_SingleMonitor`, `_CloneTwoMonitors`.
- `TestFeh_Apply_ReordersByXineramaIndex` — primary-on-right case, asserts
  the right monitor's path is emitted first.
- `TestFeh_Apply_LeftPrimaryStillCorrect` — head 0 is the geometrically-left
  monitor; argv comes out in geometry order without contortion.
- `TestFeh_Apply_FallsBackOnEmptyXineramaOrder` — graceful fallback.

---

## Not changed

- Other backends (awww, swaybg, hyprpaper, mpvpaper, wal-qt): unchanged.
- `Backend` interface, `Snapshot` shape, `Monitor` shape, `Splitter`
  signature: unchanged from the pre-`X11SpanPath` baseline.
