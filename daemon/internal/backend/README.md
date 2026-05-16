# Adding a Backend

This document is the single reference for implementing a new wallpaper backend. Read it before looking at any existing backend source.

---

## The Backend Interface

Every backend implements `backend.Backend` (defined in `backend.go`):

```go
type Backend interface {
    Name()             string
    IsAvailable()      bool
    Capabilities()     Capabilities
    Initialize(ctx context.Context) error
    Shutdown(ctx context.Context) error
    Apply(ctx context.Context, snap Snapshot) error
    RegisterDefaults(v *viper.Viper)
    ValidateConfig(raw json.RawMessage) error
}
```

One-line responsibilities:

| Method | Responsibility |
|---|---|
| `Name()` | Return the stable registry ID (e.g. `"swaybg"`). Must be unique. Never changes. |
| `IsAvailable()` | Return true if the backend binary (or daemon) is present on this machine. Called at startup and on each `GET /backends`. |
| `Capabilities()` | Declare which `ContentKind` values and compositor protocols this backend accepts. |
| `Initialize(ctx)` | Start any background process the backend needs. No-op for one-shot setters. |
| `Shutdown(ctx)` | Stop background processes. Mirror of Initialize. |
| `Apply(ctx, snap)` | Set wallpapers. See contract below. |
| `RegisterDefaults(v)` | Call `v.SetDefault("backend.<name>.<key>", value)` for every config key the backend reads. Called at startup for all backends (not just the active one). |
| `ValidateConfig(raw)` | Unmarshal `raw` into the backend's config struct and return any error. Used before persisting a PATCH. |

For `ValidateConfig`, use the generic helper if you just need basic JSON validation:

```go
func (b *MyBackend) ValidateConfig(raw json.RawMessage) error {
    return backend.UnmarshalValidateConfig[MyBackendConfig](raw)
}
```

---

## The Apply Contract

`Apply(ctx, snap)` must satisfy all five clauses:

1. If Apply returns nil, every `Output` in `snap` is reflected on its monitor. Never return nil on partial success.
2. On error, display state is indeterminate. The caller does not assume rollback.
3. Apply must be idempotent: calling with the same snapshot twice produces the same result as calling once.
4. Apply must honor `ctx` cancellation.
5. After Apply returns (success or failure), the backend must be in a state where the next Apply can succeed. Do not leave processes in a broken state that prevents recovery.

---

## Content Variants

The snapshot carries typed content per output. Type-switch on `output.Content`:

```go
for _, out := range snap.Outputs {
    switch c := out.Content.(type) {
    case backend.StaticImage:
        // c.Path_ is the absolute file path
    case backend.GIF:
        // c.Path_ is the absolute file path
    case backend.Video:
        // c.Path_, c.AudioEnabled
    case backend.WebWallpaper:
        // c.ManifestPath, c.PackageRoot, c.Config (json.RawMessage), c.ParallaxDirection
    }
}
```

`ContentKind` constants (`KindStaticImage`, `KindGIF`, `KindVideo`, `KindWebWallpaper`) are string values used in `Capabilities` and in the HTTP API wire format.

Only handle the variants your backend supports. If the snapshot contains an unsupported variant, return an error — the orchestration layer validates capabilities before calling Apply and should not send unsupported kinds, but Apply must not silently ignore them.

---

## Capabilities

Declare exactly what your backend can do:

```go
func (b *MyBackend) Capabilities() backend.Capabilities {
    return backend.Capabilities{
        ContentKinds: []backend.ContentKind{backend.KindStaticImage},
        Compositors:  []monitor.CompositorType{monitor.CompositorWayland},
    }
}
```

Rules:
- List only the content kinds your backend actually handles.
- List only the compositor protocols your backend actually works on.
- Do not add fields or kinds "for future use." If you haven't verified it against the actual setter binary, it does not belong here.

---

## Reading Viper Config at Apply Time

Do not cache config in struct fields. Read from viper inside Apply:

```go
func (b *MyBackend) Apply(ctx context.Context, snap backend.Snapshot) error {
    fitMode := viper.GetString("backend.mybackend.fit_mode")
    // use fitMode when building the command
}
```

This ensures that a `PATCH /config/backends/mybackend` immediately takes effect on the next Apply without any restart or notification method.

Register defaults in `RegisterDefaults`:

```go
func (b *MyBackend) RegisterDefaults(v *viper.Viper) {
    v.SetDefault("backend.mybackend.fit_mode", "fill")
}
```

The viper key prefix is always `backend.<name>.<key>` where `<name>` is the return value of `Name()`.

---

## Test Coverage: Shadow Harness

The `shadowtest` package provides a harness for validating Apply behavior without a real compositor. See `daemon/internal/backend/shadowtest/` for the pattern.

The harness captures what commands or HTTP calls the backend would make, then asserts they match a fixture. Use it to cover:
- Single monitor
- Multiple monitors (clone)
- Each content kind your backend supports

---

## Anti-Pattern Guard

Before declaring a capability or reading a config key:

1. Verify the setter binary actually supports it (`--help`, man page, or source).
2. Test it manually against a real compositor.
3. If in doubt, leave it out. A missing capability causes a graceful skip; a wrong one causes silent misbehavior.

Do not add backend-name conditional branches outside the backend package. The orchestrator dispatches purely on capabilities and content variants.
