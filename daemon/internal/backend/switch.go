package backend

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

type SwitchOpts struct {
	PersistConfig bool
}

type ConfigPersister interface {
	SetActiveBackendType(name string) error
}

var switchMu sync.Mutex

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
