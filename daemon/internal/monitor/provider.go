package monitor

import (
	"context"
	"errors"
)

// ErrProviderNotApplicable signals that a provider has positively concluded
// it cannot run in the current session — its protocol is not advertised, its
// CLI tool is not installed, its compositor mismatches, etc. The
// MonitorManager treats this as "try the next provider in priority order."
//
// Providers MUST NOT return this for transient or environmental failures
// (broken socket, dispatch error, malformed output, timeout). Those bubble
// up as ordinary errors so callers see the real cause rather than an empty
// result that masks a broken environment.
//
// Detect SHOULD be idempotent w.r.t. this sentinel: once a provider returns
// it, it should keep returning it until the environment changes. Once a
// provider has succeeded, it should not later return this sentinel — that's
// a contract violation the manager will surface as a real error.
var ErrProviderNotApplicable = errors.New("monitor provider not applicable to this session")

// MonitorProvider is the interface for a specific monitor detection mechanism.
//
// Multiple providers can exist for the same compositor. For example, on Wayland:
//   - wal-qt (priority 30) — topology from control API when the sidecar runs
//   - wlr-output-management (priority 20) — wlroots/KDE
//   - wl_output legacy (priority 5) — fallback for compositors without wlr-output-management
//
// The MonitorManager tries providers in descending priority order. A provider
// that cannot run in the current session signals so by returning
// ErrProviderNotApplicable from Detect; the manager moves on to the next
// candidate. Any other error bubbles up to the caller — once a provider
// claims to be applicable, its failures are real failures, not "try someone
// else."
type MonitorProvider interface {
	// Name returns a human-readable identifier for this provider
	// (e.g. "wayland-wlr-output", "wal-qt").
	Name() string

	// Compositor returns which compositor type this provider serves.
	Compositor() CompositorType

	// Priority determines provider preference when multiple providers match
	// the same compositor. Higher values are tried first.
	Priority() int

	// Detect queries the system for connected monitors.
	//
	// Returns ErrProviderNotApplicable when the provider has determined it
	// cannot run in the current session (e.g. its protocol isn't advertised
	// or its CLI tool isn't installed). Returns any other error for
	// environmental failures the caller should see directly.
	//
	// Detect should be a fresh query (not cached); the manager handles caching.
	Detect(ctx context.Context) ([]Monitor, error)
}
