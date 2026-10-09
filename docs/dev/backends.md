# Adding a backend

A backend is what puts pixels on a monitor (`awww`, `swaybg`, `feh`, `mpvpaper`...). The engine handles everything else, so a backend stays small; the smallest, `feh`, is about 175 lines. Full reference: [`daemon/internal/backend/README.md`](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/internal/backend/README.md). To use existing backends, see [Backends](/manual/backends).

## The interface

From `daemon/internal/backend/backend.go`:

```go
type Backend interface {
    Name() string
    IsAvailable() bool
    Capabilities() Capabilities
    Initialize(ctx context.Context) error
    Shutdown(ctx context.Context) error
    Apply(ctx context.Context, snap Snapshot) error
    RegisterDefaults(v *viper.Viper)
    ValidateConfig(raw json.RawMessage) error
}
```

| Method | Job |
| --- | --- |
| `Name()` | Unique registry id and config key (`[backend.<name>]`). |
| `IsAvailable()` | Is the setter installed? Usually `exec.LookPath`. |
| `Capabilities()` | Content kinds and compositors you handle; list only what you've tested. |
| `Initialize` / `Shutdown` | Start and stop whatever you need; no-ops for one-shot setters. |
| `Apply(ctx, snap)` | Set the wallpapers (rules below). |
| `RegisterDefaults` | `v.SetDefault("backend.<name>.<key>", ...)` for every key you read. |
| `ValidateConfig` | Validate a config PATCH; `backend.UnmarshalValidateConfig[Config](raw)` is usually enough. |

To read config, implement `SetConfigReader(r backend.ConfigReader)` and read inside `Apply`, so changes apply without a restart. Don't use global `viper`.

`Apply` rules:

- Return nil only if every output in the snapshot is showing; never on partial success.
- Be idempotent, honour `ctx`, and return nil on an empty snapshot.
- Whether it succeeds or fails, the next `Apply` must be able to succeed.

A `Snapshot` is a list of `Output{Monitor, Content}`. Extend-mode splitting happens before you; paint what you're given. `Content` is `StaticImage`, `GIF`, `Video` or `WebWallpaper` (`daemon/internal/backend/content.go`); each has `Path()`, so a static-only backend can just call it. The daemon rejects kinds you didn't declare in `Capabilities`.

## Example: `feh`

Copy `daemon/internal/backend/feh/` (`config.go`, `feh.go`, `feh_test.go`). The core:

```go
func (f *Feh) Name() string { return "feh" }

func (f *Feh) IsAvailable() bool {
    _, err := exec.LookPath("feh")
    return err == nil
}

func (f *Feh) Capabilities() backend.Capabilities {
    return backend.Capabilities{
        ContentKinds: []backend.ContentKind{backend.KindStaticImage},
        Compositors:  []monitor.CompositorType{monitor.CompositorX11},
    }
}

func (f *Feh) Initialize(_ context.Context) error { return nil }
func (f *Feh) Shutdown(_ context.Context) error   { return nil }

func (f *Feh) RegisterDefaults(v *viper.Viper) {
    v.SetDefault("backend.feh.mode", string(ModeFill))
}
func (f *Feh) ValidateConfig(raw json.RawMessage) error {
    return backend.UnmarshalValidateConfig[Config](raw)
}
```

`Apply` reads the mode, builds one argv from the output paths and runs it through an injectable `execFn` so tests don't need `feh`. For a long-lived setter, see `daemon/internal/backend/swaybg/swaybg.go`.

## Register it

1. `daemon/cmd/daemon/main.go`: add `yourbackend.New()` to the `backends` slice.
2. `daemon/internal/backenddefaults/defaults.go`: add it to `RegisterInto` and the `Subtree` switch.
3. `daemon/internal/backend/apply_shim_test.go`: add it to the backend lists.
4. `daemon/internal/config/viper_manager.go`: add it to `backend.auto_priorities.*` if it should take part in auto mode.
5. `electron/daemon-go-types.ts`: add a `YourBackendConfig` type.
6. UI: add its fields in `src/components/settings/sections/BackendSettingsSection.tsx` (field list, the switch, `BACKEND_MEDIA_SUPPORT`) and its prefix in `src/utils/backendFieldPrefixes.ts`.
7. Docs: [Backends](/manual/backends) and [Config](/reference/config).

## Tests to write

- Name and capabilities match what you declared.
- `Apply` argv for one monitor, several monitors, and each supported content kind, with the exec function injected.
- Empty snapshot returns nil (`apply_shim_test.go` covers it once registered).
- Defaults register, a bad payload fails `ValidateConfig`, and a changed value shows up in the next argv.
- A non-zero exit makes `Apply` return an error and a second `Apply` still works.

```bash
cd daemon && go test ./internal/backend/...
```

Also run the setter by hand and through the daemon before you declare any capability.
