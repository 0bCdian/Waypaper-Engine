package control

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"waypaper-engine/daemon/internal/backend"
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
		if syncer, ok := b.(backend.RuntimeConfigSync); ok {
			if err := syncer.SyncRuntimeFromConfig(ctx); err != nil {
				slog.Warn("backend runtime sync after config save failed", "backend", name, "error", err)
			}
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
