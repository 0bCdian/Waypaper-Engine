package backend

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
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

// switchMu serialises the whole Shutdown -> SetActive -> Initialize transition.
// The registry's own methods are individually locked, but the transition is not
// atomic without this: two callers could otherwise interleave so that one
// initializes the other's backend while the registry points at a third.
var switchMu sync.Mutex

// SwitchActiveBackend shuts down the current backend, activates the named one,
// and initializes it. On init failure it rolls back to the previous backend.
// It returns the backend that is active on success — callers must use this value
// rather than re-reading Registry.Active(), which another switch may have moved.
//
// Callers are responsible for any post-switch work (restore wallpapers, apply
// a specific wallpaper, fire SSE events, etc.) — this function only handles
// the lifecycle transition.
func SwitchActiveBackend(ctx context.Context, reg Registry, name string, cfg ConfigPersister, opts SwitchOpts) (Backend, error) {
	switchMu.Lock()
	defer switchMu.Unlock()

	current := reg.Active()
	if current != nil && current.Name() == name {
		return current, nil
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
		return nil, fmt.Errorf("set active %q: %w", name, err)
	}

	newBackend := reg.Active()
	if newBackend == nil {
		return nil, fmt.Errorf("backend %q disappeared from registry after activation", name)
	}
	if err := newBackend.Initialize(ctx); err != nil {
		if current != nil {
			_ = rollback(ctx, reg, current.Name())
		}
		return nil, fmt.Errorf("initialize %q: %w", name, err)
	}

	if opts.PersistConfig && cfg != nil {
		if err := cfg.SetActiveBackendType(name); err != nil {
			slog.Warn("switch backend: persist config failed", "backend", name, "error", err)
		}
	}

	slog.Info("backend switched", "from", backendName(current), "to", name, "persisted", opts.PersistConfig)
	return newBackend, nil
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
