package backend

import (
	"context"
	"fmt"
	"log/slog"
)

// SwitchOpts controls the behavior of SwitchActiveBackend.
type SwitchOpts struct {
	// PersistConfig writes the new backend name to config when true.
	// User-driven activation sets this to true; auto-mode switches set it to false
	// to avoid rewriting config.toml every playlist tick.
	PersistConfig bool
}

// ConfigPersister writes the active backend type to the persistent config.
type ConfigPersister interface {
	SetActiveBackendType(name string) error
}

// SwitchActiveBackend shuts down the current backend, activates the named one,
// and initializes it. On init failure it rolls back to the previous backend.
//
// Callers are responsible for any post-switch work (restore wallpapers, apply
// a specific wallpaper, fire SSE events, etc.) — this function only handles
// the lifecycle transition.
func SwitchActiveBackend(ctx context.Context, reg Registry, name string, cfg ConfigPersister, opts SwitchOpts) error {
	current := reg.Active()
	if current != nil && current.Name() == name {
		return nil
	}

	if current != nil {
		if err := current.Shutdown(ctx); err != nil {
			slog.Warn("switch backend: shutdown failed", "backend", current.Name(), "error", err)
		}
	}

	if err := reg.SetActive(name); err != nil {
		if current != nil {
			_ = rollback(ctx, reg, current.Name())
		}
		return fmt.Errorf("set active %q: %w", name, err)
	}

	newBackend := reg.Active()
	if err := newBackend.Initialize(ctx); err != nil {
		if current != nil {
			_ = rollback(ctx, reg, current.Name())
		}
		return fmt.Errorf("initialize %q: %w", name, err)
	}

	if opts.PersistConfig && cfg != nil {
		if err := cfg.SetActiveBackendType(name); err != nil {
			slog.Warn("switch backend: persist config failed", "backend", name, "error", err)
		}
	}

	slog.Info("backend switched", "from", backendName(current), "to", name, "persisted", opts.PersistConfig)
	return nil
}

func rollback(ctx context.Context, reg Registry, name string) error {
	if err := reg.SetActive(name); err != nil {
		return fmt.Errorf("rollback set active %q: %w", name, err)
	}
	b := reg.Active()
	if err := b.Initialize(ctx); err != nil {
		return fmt.Errorf("rollback initialize %q: %w", name, err)
	}
	return nil
}

func backendName(b Backend) string {
	if b == nil {
		return "<none>"
	}
	return b.Name()
}
