// Package suspend detects system suspend/resume via logind's PrepareForSleep
// D-Bus signal, so callers can re-apply state that a sleep cycle may have
// invalidated (e.g. a monitor dropped from a cached snapshot).
package suspend

import (
	"context"
	"log/slog"

	"github.com/godbus/dbus/v5"
)

const (
	loginManagerInterface = "org.freedesktop.login1.Manager"
	prepareForSleepMember = "PrepareForSleep"
	prepareForSleepSignal = loginManagerInterface + "." + prepareForSleepMember
)

// conn is the subset of *dbus.Conn that watchLoop needs, narrowed so the
// suspend/resume reaction logic is testable without a real system bus.
type conn interface {
	AddMatchSignal(options ...dbus.MatchOption) error
	Signal(ch chan<- *dbus.Signal)
	Close() error
}

// WatchResume runs until ctx is done, calling onResume every time logind
// reports the system has just woken from suspend. Connecting to the system
// bus is best-effort: a distro without systemd-logind/elogind, or a sandbox
// without bus access, just runs on without resume detection rather than
// blocking startup.
func WatchResume(ctx context.Context, onResume func()) {
	c, err := dbus.ConnectSystemBus()
	if err != nil {
		slog.Warn("suspend: system bus unavailable, resume detection disabled", "error", err)
		return
	}
	defer c.Close()

	if err := watchLoop(ctx, c, onResume); err != nil && ctx.Err() == nil {
		slog.Warn("suspend: resume watcher stopped", "error", err)
	}
}

// watchLoop subscribes to logind's PrepareForSleep signal on c and calls
// onResume for every "false" (just-woke) event, until ctx is cancelled or the
// signal channel closes.
func watchLoop(ctx context.Context, c conn, onResume func()) error {
	if err := c.AddMatchSignal(
		dbus.WithMatchInterface(loginManagerInterface),
		dbus.WithMatchMember(prepareForSleepMember),
	); err != nil {
		return err
	}

	sigCh := make(chan *dbus.Signal, 8)
	c.Signal(sigCh)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case sig, ok := <-sigCh:
			if !ok {
				return nil
			}
			handleSignal(sig, onResume)
		}
	}
}

// handleSignal invokes onResume only for a well-formed PrepareForSleep(false)
// signal — the moment logind reports the machine just woke up.
func handleSignal(sig *dbus.Signal, onResume func()) {
	if sig == nil || sig.Name != prepareForSleepSignal || len(sig.Body) == 0 {
		return
	}
	asleep, ok := sig.Body[0].(bool)
	if !ok || asleep {
		return
	}
	onResume()
}
