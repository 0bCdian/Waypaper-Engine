package backend

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
)

// stubBackend is a minimal Backend implementation for registry tests.
// Defined locally to avoid a circular import with the testutil package.
type stubBackend struct {
	name  string
	avail bool
	caps  Capabilities
}

func (s *stubBackend) Name() string                                         { return s.name }
func (s *stubBackend) IsAvailable() bool                                    { return s.avail }
func (s *stubBackend) Capabilities() Capabilities                           { return s.caps }
func (s *stubBackend) Initialize(context.Context) error                     { return nil }
func (s *stubBackend) Shutdown(context.Context) error                       { return nil }
func (s *stubBackend) SetWallpaper(context.Context, WallpaperRequest) error { return nil }
func (s *stubBackend) RegisterDefaults(*viper.Viper)                        {}
func (s *stubBackend) ValidateConfig(json.RawMessage) error                 { return nil }
func (s *stubBackend) ParseConfig(json.RawMessage) (any, error)             { return nil, nil }

func TestRegistry_RegisterAndGet(t *testing.T) {
	reg := NewRegistry()
	b := &stubBackend{name: "test-backend", avail: true}

	require.NoError(t, reg.Register(b))

	got, ok := reg.Get("test-backend")
	require.True(t, ok)
	assert.Equal(t, "test-backend", got.Name())
}

func TestRegistry_RegisterDuplicate(t *testing.T) {
	reg := NewRegistry()
	b := &stubBackend{name: "dup", avail: true}

	require.NoError(t, reg.Register(b))
	err := reg.Register(b)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
}

func TestRegistry_GetUnknown(t *testing.T) {
	reg := NewRegistry()
	_, ok := reg.Get("nonexistent")
	assert.False(t, ok)
}

func TestRegistry_SetActive(t *testing.T) {
	reg := NewRegistry()
	b := &stubBackend{name: "awww", avail: true}

	require.NoError(t, reg.Register(b))
	require.NoError(t, reg.SetActive("awww"))
	assert.Equal(t, "awww", reg.Active().Name())
}

func TestRegistry_SetActive_Unknown(t *testing.T) {
	reg := NewRegistry()
	err := reg.SetActive("ghost")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not registered")
}

func TestRegistry_SetActive_Unavailable(t *testing.T) {
	reg := NewRegistry()
	b := &stubBackend{name: "feh", avail: false}

	require.NoError(t, reg.Register(b))
	err := reg.SetActive("feh")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not available")
}

func TestRegistry_Available(t *testing.T) {
	reg := NewRegistry()
	require.NoError(t, reg.Register(&stubBackend{name: "beta", avail: true}))
	require.NoError(t, reg.Register(&stubBackend{name: "alpha", avail: false}))

	infos := reg.Available()
	require.Len(t, infos, 2)
	assert.Equal(t, "alpha", infos[0].Name)
	assert.False(t, infos[0].Available)
	assert.Equal(t, "beta", infos[1].Name)
	assert.True(t, infos[1].Available)
}

func TestRegistry_Compatible(t *testing.T) {
	reg := NewRegistry()
	require.NoError(t, reg.Register(&stubBackend{
		name:  "wayland-only",
		avail: true,
		caps:  Capabilities{Compositors: []monitor.CompositorType{monitor.CompositorWayland}},
	}))
	require.NoError(t, reg.Register(&stubBackend{
		name:  "x11-only",
		avail: true,
		caps:  Capabilities{Compositors: []monitor.CompositorType{monitor.CompositorX11}},
	}))
	require.NoError(t, reg.Register(&stubBackend{
		name:  "both",
		avail: true,
		caps:  Capabilities{Compositors: []monitor.CompositorType{monitor.CompositorWayland, monitor.CompositorX11}},
	}))

	wayland := reg.Compatible(monitor.CompositorWayland)
	waylandNames := make([]string, len(wayland))
	for i, info := range wayland {
		waylandNames[i] = info.Name
	}
	assert.Equal(t, []string{"both", "wayland-only"}, waylandNames)

	x11 := reg.Compatible(monitor.CompositorX11)
	x11Names := make([]string, len(x11))
	for i, info := range x11 {
		x11Names[i] = info.Name
	}
	assert.Equal(t, []string{"both", "x11-only"}, x11Names)
}
