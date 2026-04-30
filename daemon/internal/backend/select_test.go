package backend_test

import (
	"testing"

	"context"
	"encoding/json"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

type stubBackend struct {
	name      string
	available bool
	caps      backend.Capabilities
}

func (s *stubBackend) Name() string                                                     { return s.name }
func (s *stubBackend) IsAvailable() bool                                                { return s.available }
func (s *stubBackend) Capabilities() backend.Capabilities                               { return s.caps }
func (s *stubBackend) Initialize(_ context.Context) error                               { return nil }
func (s *stubBackend) Shutdown(_ context.Context) error                                 { return nil }
func (s *stubBackend) SetWallpaper(_ context.Context, _ backend.WallpaperRequest) error { return nil }
func (s *stubBackend) RegisterDefaults(_ *viper.Viper)                                  {}
func (s *stubBackend) ValidateConfig(_ json.RawMessage) error                           { return nil }
func (s *stubBackend) ParseConfig(_ json.RawMessage) (any, error)                       { return nil, nil }
func (s *stubBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error       { return nil }

type stubRegistry struct {
	backends map[string]*stubBackend
	active   *stubBackend
}

func (r *stubRegistry) Register(_ backend.Backend) error                          { return nil }
func (r *stubRegistry) SetActive(_ string) error                                  { return nil }
func (r *stubRegistry) Available() []backend.BackendInfo                          { return nil }
func (r *stubRegistry) Compatible(_ monitor.CompositorType) []backend.BackendInfo { return nil }

func (r *stubRegistry) Active() backend.Backend {
	if r.active == nil {
		return nil
	}
	return r.active
}
func (r *stubRegistry) Get(name string) (backend.Backend, bool) {
	b, ok := r.backends[name]
	if !ok {
		return nil, false
	}
	return b, true
}

func newStubRegistry(active string, bs ...*stubBackend) *stubRegistry {
	reg := &stubRegistry{backends: make(map[string]*stubBackend)}
	for _, b := range bs {
		reg.backends[b.name] = b
		if b.name == active {
			reg.active = b
		}
	}
	return reg
}

var (
	awww = &stubBackend{
		name: "awww", available: true,
		caps: backend.Capabilities{MediaTypes: []media.MediaType{media.MediaTypeImage, media.MediaTypeGIF}},
	}
	utauri = &stubBackend{
		name: "wayland-utauri", available: true,
		caps: backend.Capabilities{MediaTypes: []media.MediaType{media.MediaTypeImage, media.MediaTypeGIF, media.MediaTypeVideo, media.MediaTypeWeb}},
	}
	mpv = &stubBackend{
		name: "mpvpaper", available: true,
		caps: backend.Capabilities{MediaTypes: []media.MediaType{media.MediaTypeVideo}},
	}
	unavailFeh = &stubBackend{
		name: "feh", available: false,
		caps: backend.Capabilities{MediaTypes: []media.MediaType{media.MediaTypeImage}},
	}
)

func defaultPriorities() map[string][]string {
	return map[string][]string{
		"image": {"awww", "wayland-utauri"},
		"video": {"mpvpaper", "wayland-utauri"},
		"web":   {"wayland-utauri"},
	}
}

func TestPickBackend_FixedMode(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri)
	name, err := backend.PickBackend(reg, "fixed", "video", defaultPriorities())
	require.NoError(t, err)
	assert.Equal(t, "awww", name)
}

func TestPickBackend_Auto_Image(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri, mpv)
	name, err := backend.PickBackend(reg, "auto", "image", defaultPriorities())
	require.NoError(t, err)
	assert.Equal(t, "awww", name)
}

func TestPickBackend_Auto_Video(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri, mpv)
	name, err := backend.PickBackend(reg, "auto", "video", defaultPriorities())
	require.NoError(t, err)
	assert.Equal(t, "mpvpaper", name)
}

func TestPickBackend_Auto_Web(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri, mpv)
	name, err := backend.PickBackend(reg, "auto", "web", defaultPriorities())
	require.NoError(t, err)
	assert.Equal(t, "wayland-utauri", name)
}

func TestPickBackend_Auto_GIF_UsesImagePriority(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri, mpv)
	name, err := backend.PickBackend(reg, "auto", "gif", defaultPriorities())
	require.NoError(t, err)
	assert.Equal(t, "awww", name)
}

func TestPickBackend_Auto_SkipsUnavailable(t *testing.T) {
	reg := newStubRegistry("wayland-utauri", unavailFeh, utauri)
	prio := map[string][]string{"image": {"feh", "wayland-utauri"}}
	name, err := backend.PickBackend(reg, "auto", "image", prio)
	require.NoError(t, err)
	assert.Equal(t, "wayland-utauri", name)
}

func TestPickBackend_Auto_SkipsUnregistered(t *testing.T) {
	reg := newStubRegistry("awww", awww)
	prio := map[string][]string{"image": {"nonexistent", "awww"}}
	name, err := backend.PickBackend(reg, "auto", "image", prio)
	require.NoError(t, err)
	assert.Equal(t, "awww", name)
}

func TestPickBackend_Auto_NoCompatible(t *testing.T) {
	reg := newStubRegistry("awww", awww)
	prio := map[string][]string{"video": {"awww"}}
	_, err := backend.PickBackend(reg, "auto", "video", prio)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no available backend supports")
}

func TestPickBackend_Auto_EmptyPriorityList(t *testing.T) {
	reg := newStubRegistry("awww", awww)
	prio := map[string][]string{"web": {}}
	_, err := backend.PickBackend(reg, "auto", "web", prio)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no priority list")
}

func TestPickBackend_Auto_MissingCategory(t *testing.T) {
	reg := newStubRegistry("awww", awww)
	prio := map[string][]string{"image": {"awww"}}
	_, err := backend.PickBackend(reg, "auto", "web", prio)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no priority list configured for media category")
}

func TestValidateAutoPriorities_Valid(t *testing.T) {
	reg := newStubRegistry("awww", awww, utauri, mpv)
	errs := backend.ValidateAutoPriorities(reg, defaultPriorities())
	assert.Empty(t, errs)
}

func TestValidateAutoPriorities_UnregisteredBackend(t *testing.T) {
	reg := newStubRegistry("awww", awww)
	prio := map[string][]string{"image": {"awww", "nonexistent"}}
	errs := backend.ValidateAutoPriorities(reg, prio)
	require.Contains(t, errs, "image")
	assert.Contains(t, errs["image"][0], "not registered")
}

func TestValidateAutoPriorities_IncompatibleBackend(t *testing.T) {
	reg := newStubRegistry("awww", awww, mpv)
	prio := map[string][]string{"image": {"awww", "mpvpaper"}}
	errs := backend.ValidateAutoPriorities(reg, prio)
	require.Contains(t, errs, "image")
	assert.Contains(t, errs["image"][0], "does not support image")
}
