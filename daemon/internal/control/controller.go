package control

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backenddefaults"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
)

// ErrUnknownBackend is returned when UpdateBackendConfig names an unregistered backend.
var ErrUnknownBackend = errors.New("unknown backend")

// InvalidBackendConfigError wraps backend.ValidateConfig failures from UpdateBackendConfig.
type InvalidBackendConfigError struct {
	Cause error
}

func (e *InvalidBackendConfigError) Error() string {
	return "invalid backend config: " + e.Cause.Error()
}

func (e *InvalidBackendConfigError) Unwrap() error {
	return e.Cause
}

// Restorer runs best-effort wallpaper restore after backend activation.
type Restorer interface {
	Restore(ctx context.Context)
}

// RestoreFunc adapts a function to Restorer.
type RestoreFunc func(ctx context.Context)

func (f RestoreFunc) Restore(ctx context.Context) {
	f(ctx)
}

// Controller owns control-plane policy for config and backend activation.
type Controller struct {
	cfg      config.ConfigManager
	registry backend.Registry
	bus      events.Bus
	restore  Restorer
}

// NewController wires the control plane. restorer may be nil (activation skips restore).
func NewController(cfg config.ConfigManager, registry backend.Registry, bus events.Bus, restorer Restorer) *Controller {
	return &Controller{
		cfg:      cfg,
		registry: registry,
		bus:      bus,
		restore:  restorer,
	}
}

// ActivationResult summarizes a successful activation attempt.
type ActivationResult struct {
	Backend       string
	AlreadyActive bool
}

func (c *Controller) GetConfig() (*config.Config, error) {
	return c.cfg.GetConfig()
}

// MergedConfigJSON returns the full config as a JSON object for GET /config (and PATCH /config responses).
// Each registered backend's effective [backend.<name>] map is merged under backend.<name> so renderers
// see the same defaults and file values as Viper + RegisterDefaults. Typed config.Config intentionally
// omits those subtrees.
//
// When backend.transition_duration_seconds is set, it overlays awww.transition_duration and
// wal-qt.duration_ms to match wallpaper runtime behavior.
func (c *Controller) MergedConfigJSON() (map[string]any, error) {
	cfg, err := c.cfg.GetConfig()
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("control: marshal config: %w", err)
	}
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("control: unmarshal config map: %w", err)
	}

	bAny, ok := root["backend"].(map[string]any)
	if !ok {
		bAny = map[string]any{}
		root["backend"] = bAny
	}

	for _, info := range c.registry.Available() {
		name := info.Name
		subRaw, err := c.cfg.GetBackendConfig(name)
		if err != nil {
			return nil, fmt.Errorf("control: backend %s config: %w", name, err)
		}
		var sub map[string]any
		if err := json.Unmarshal(subRaw, &sub); err != nil {
			return nil, fmt.Errorf("control: backend %s json: %w", name, err)
		}
		if sub == nil {
			sub = map[string]any{}
		}
		bAny[name] = sub
	}

	canon := cfg.Backend.TransitionDurationSeconds
	if canon > 0 {
		if canon > 120 {
			canon = 120
		}
		if awww, ok := bAny["awww"].(map[string]any); ok {
			awww["transition_duration"] = canon
		}
		if wut, ok := bAny["wal-qt"].(map[string]any); ok {
			ms := int(math.Round(canon * 1000))
			if ms < 1 {
				ms = 1
			}
			const maxMS = 120_000
			if ms > maxMS {
				ms = maxMS
			}
			wut["duration_ms"] = ms
		}
	}

	return root, nil
}

func (c *Controller) UpdateConfig(section string, values map[string]any) error {
	if err := c.cfg.UpdateConfig(section, values); err != nil {
		return err
	}
	c.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": []string{section}},
	})
	return nil
}

func (c *Controller) GetSection(section string) (map[string]any, error) {
	return c.cfg.GetSection(section)
}

func (c *Controller) GetBackendConfig(name string) (json.RawMessage, error) {
	return c.cfg.GetBackendConfig(name)
}

// NamedBackendExists reports whether the registry knows the backend name.
func (c *Controller) NamedBackendExists(name string) bool {
	_, ok := c.registry.Get(name)
	return ok
}

func (c *Controller) UpdateBackendConfig(ctx context.Context, name string, raw json.RawMessage) error {
	b, ok := c.registry.Get(name)
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnknownBackend, name)
	}
	if err := b.ValidateConfig(raw); err != nil {
		return &InvalidBackendConfigError{Cause: err}
	}
	if err := c.cfg.SetBackendConfig(name, raw); err != nil {
		return err
	}
	active := c.cfg.GetActiveBackendType()
	if name == active {
		// Re-apply current wallpaper so backends reflect new config immediately.
		if c.restore != nil {
			c.restore.Restore(ctx)
		}
	}
	c.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": []string{"backend." + name}},
	})
	return nil
}

func (c *Controller) ActivateBackend(ctx context.Context, name string) (ActivationResult, error) {
	if cur := c.registry.Active(); cur != nil && cur.Name() == name {
		return ActivationResult{Backend: name, AlreadyActive: true}, nil
	}
	if err := backend.SwitchActiveBackend(ctx, c.registry, name, c.cfg, backend.SwitchOpts{
		PersistConfig: true,
	}); err != nil {
		return ActivationResult{}, err
	}
	if c.restore != nil {
		c.restore.Restore(ctx)
	}
	c.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": []string{"backend"}},
	})
	return ActivationResult{Backend: name}, nil
}

// ResetAllConfigToDefaults restores every config section plus all backend subtrees to built-in defaults.
func (c *Controller) ResetAllConfigToDefaults(ctx context.Context) error {
	if err := c.cfg.ResetToFactoryDefaults(backenddefaults.RegisterInto); err != nil {
		return err
	}

	want := c.cfg.GetActiveBackendType()
	if err := backend.SwitchActiveBackend(ctx, c.registry, want, c.cfg, backend.SwitchOpts{PersistConfig: false}); err != nil {
		slog.Warn("factory reset: could not activate configured backend", "backend", want, "error", err)
	}

	if c.restore != nil {
		c.restore.Restore(ctx)
	}

	c.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{
			"sections": []string{"app", "daemon", "backend", "monitors", "wallhaven"},
			"source":   "api_reset_all",
		},
	})
	return nil
}

// ResetBackendConfigToDefaults replaces persisted [backend.<name>] with defaults for that setter only.
func (c *Controller) ResetBackendConfigToDefaults(ctx context.Context, name string) error {
	b, ok := c.registry.Get(name)
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnknownBackend, name)
	}

	defaults, err := backenddefaults.Subtree(name)
	if err != nil {
		return err
	}

	raw, err := json.Marshal(defaults)
	if err != nil {
		return fmt.Errorf("control: marshal default backend config: %w", err)
	}

	if err := b.ValidateConfig(raw); err != nil {
		return &InvalidBackendConfigError{Cause: err}
	}

	if err := c.cfg.ReplaceBackendNamedConfig(name, defaults); err != nil {
		return err
	}

	active := c.cfg.GetActiveBackendType()
	if name == active {
		if c.restore != nil {
			c.restore.Restore(ctx)
		}
	}

	c.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{
			"sections": []string{"backend." + name},
			"source":   "api_reset_backend",
		},
	})
	return nil
}
