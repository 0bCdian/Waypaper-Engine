package shadowtest

// mpvpaper equivalence definition:
//
// Unlike single-process backends (swaybg, feh), mpvpaper runs one process per
// Wayland output. "Byte-identical argv" is therefore ambiguous across multiple
// outputs. Instead, equivalence is defined as:
//
//   - The set of (monitor → argv) for "start" actions is identical, AND
//   - The set of monitors for "kill" actions is identical.
//
// The captor serialises the captured action sequence into a deterministic byte
// representation (sorted by monitor name, then action type) so that
// CompareFixture's byte comparison works correctly.

import (
	"fmt"
	"os/exec"
	"sort"
	"sync"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	backendmpvpaper "waypaper-engine/daemon/internal/backend/mpvpaper"
)

// MpvAction records one exec or kill event during a captured Apply/SetWallpaper call.
type MpvAction struct {
	Kind    string // "start" or "kill"
	Monitor string
	Argv    []string // nil for kill actions
}

// MpvpaperCaptor records the sequence of (action, monitor, argv) tuples emitted
// by Apply / SetWallpaper. Equivalence is defined as set equality on start actions
// (monitor → argv) and set equality on kill actions (monitor set).
type MpvpaperCaptor struct {
	backend *backendmpvpaper.Mpvpaper
	mu      sync.Mutex
	actions []MpvAction
}

// NewMpvpaperCaptor builds an Mpvpaper with its exec and kill seams replaced to
// record calls without spawning real processes.
func NewMpvpaperCaptor(t *testing.T) *MpvpaperCaptor {
	t.Helper()
	v := viper.New()
	v.Set("backend.mpvpaper.mpv_options", "loop")

	b := backendmpvpaper.New().(*backendmpvpaper.Mpvpaper)
	b.RegisterDefaults(v)

	c := &MpvpaperCaptor{backend: b}

	b.SetExecForTest(func(output string, args []string) (*exec.Cmd, error) {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.actions = append(c.actions, MpvAction{
			Kind:    "start",
			Monitor: output,
			Argv:    append([]string(nil), args...),
		})
		return nil, nil
	})

	b.SetKillForTest(func(output string) {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.actions = append(c.actions, MpvAction{
			Kind:    "kill",
			Monitor: output,
		})
	})

	return c
}

// ResetActions clears captured actions. Call before each Apply/SetWallpaper in
// reconcile tests to isolate per-call captures.
func (c *MpvpaperCaptor) ResetActions() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.actions = nil
}

// Actions returns a copy of captured actions under lock.
func (c *MpvpaperCaptor) Actions() []MpvAction {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]MpvAction, len(c.actions))
	copy(out, c.actions)
	return out
}

// Backend returns the underlying Mpvpaper for direct method calls in tests.
func (c *MpvpaperCaptor) Backend() *backendmpvpaper.Mpvpaper {
	return c.backend
}

// actionBytes serialises the captured actions to a deterministic byte slice.
// Start actions are sorted by monitor name; kill actions likewise.
// Format: "start:<monitor>:<arg0>\x00<arg1>\x00...\n" per start action,
//
//	"kill:<monitor>\n" per kill action.
func (c *MpvpaperCaptor) actionBytes() []byte {
	c.mu.Lock()
	actions := make([]MpvAction, len(c.actions))
	copy(actions, c.actions)
	c.mu.Unlock()

	// Separate starts and kills, sort each group deterministically.
	var starts, kills []MpvAction
	for _, a := range actions {
		if a.Kind == "start" {
			starts = append(starts, a)
		} else {
			kills = append(kills, a)
		}
	}
	sort.Slice(starts, func(i, j int) bool { return starts[i].Monitor < starts[j].Monitor })
	sort.Slice(kills, func(i, j int) bool { return kills[i].Monitor < kills[j].Monitor })

	var out []byte
	for _, a := range starts {
		out = append(out, []byte(fmt.Sprintf("start:%s:", a.Monitor))...)
		for k, arg := range a.Argv {
			if k > 0 {
				out = append(out, 0)
			}
			out = append(out, []byte(arg)...)
		}
		out = append(out, '\n')
	}
	for _, a := range kills {
		out = append(out, []byte(fmt.Sprintf("kill:%s\n", a.Monitor))...)
	}
	return out
}

// CaptureSetWallpaper resets both the action log and the internal process map,
// then runs SetWallpaper and returns the serialised action bytes.
// The process-map reset ensures shadow comparison starts from a clean state.
func (c *MpvpaperCaptor) CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte {
	t.Helper()
	c.ResetActions()
	c.backend.ResetProcsForTest()
	_ = c.backend.SetWallpaper(t.Context(), req)
	return c.actionBytes()
}

// CaptureApply resets both the action log and the internal process map,
// then runs Apply and returns the serialised action bytes.
// For reconcile tests that need state to persist across Apply calls, use
// ResetActions() + Backend().Apply() directly instead.
func (c *MpvpaperCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	c.ResetActions()
	c.backend.ResetProcsForTest()
	_ = c.backend.Apply(t.Context(), snap)
	return c.actionBytes()
}
