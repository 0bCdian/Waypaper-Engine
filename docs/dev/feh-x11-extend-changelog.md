# Changelog: feh extend mode + xrandr `enabled`

This document records the **final shape** of the fix for incorrect wallpaper
spanning on X11 with feh in extend mode, and for `enabled: false` on connected
outputs from xrandr.

An earlier iteration carried a backend-specific path (`X11SpanPath`) on
`backend.Snapshot` and branched on `Backend.Name() == "feh"` in the
orchestrator. That violated the rule in
[`daemon/internal/backend/README.md`](../../daemon/internal/backend/README.md)
("Do not add backend-name conditional branches outside the backend package")
and made the Snapshot carry implementation guidance instead of desired state.
It has been reverted in favour of the design below.

---

## Design

`Snapshot` describes **desired state per output** — `monitor M shows pixels P`.
*How* a backend realises that is the backend's concern.

`feh` accepts one path per Xinerama screen positionally:

    feh --bg-fill img0 img1 ...

— `img0` goes to screen 0, `img1` to screen 1, etc. The orchestrator hands
`feh` exactly the same per-output snapshot it hands the Wayland backends.
`feh.Apply` sorts outputs by `(Y, X)` to match Xinerama's geometry-derived
screen indices and emits one path argument per output.

No backend-name branching exists outside the `feh` package. The `Splitter`
returns one shape — `map[monitor.Name]path` — for every backend.

---

## Files

### `daemon/internal/backend/feh/feh.go`

`Apply` sorts `snap.Outputs` by `(Y, X)` and emits `[flag, path0, path1, ...]`,
one path per output. Works identically for clone (same path repeated N times)
and extend (one cropped path per monitor).

### `daemon/internal/monitor/provider_xrandr.go`

`parseXrandrOutputLine` sets `Enabled: true` for connected outputs with an
active mode (previously left at Go's zero value `false`).

### `daemon/internal/monitor/types.go`

Comment on `Enabled` documents that xrandr now sets it for connected
active-mode outputs.

### Tests

- `daemon/internal/backend/shadowtest/shadowtest_feh_test.go` —
  - `TestFeh_Apply_CloneTwoMonitors`: same path repeated for both heads.
  - `TestFeh_Apply_ExtendMode_PassesPerMonitorPaths`: per-output paths in
    Xinerama order.
  - `TestFeh_Apply_ExtendMode_SortsByGeometry`: outputs supplied out of
    order are reordered by `(Y, X)`.
  - `TestFeh_Apply_VerticalStack`: top monitor (lower `Y`) precedes bottom.
- `daemon/internal/monitor/provider_xrandr_test.go` —
  `TestParseXrandr_ConnectedOutputsEnabled`.

---

## Caveat

The `(Y, X)` sort assumes Xinerama indexes heads by geometry. This holds for
stock X servers and typical layouts. Mirrored heads with identical geometry,
or layouts that have been reordered via deprecated Xinerama config, may map
differently — revisit if a user reports it.

---

## Not changed

- Other backends (awww, swaybg, hyprpaper, mpvpaper, wal-qt): unchanged.
- `Backend` interface, `Snapshot` shape, `Splitter` signature: unchanged from
  the pre-`X11SpanPath` baseline.
