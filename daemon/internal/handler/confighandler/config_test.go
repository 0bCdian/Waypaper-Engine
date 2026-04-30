package confighandler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/control"
	"waypaper-engine/daemon/internal/testutil"
)

func testController(cfg *testutil.MockConfigManager, reg *testutil.MockRegistry, bus *testutil.MockBus) *control.Controller {
	return control.NewController(cfg, reg, bus, nil)
}

func TestConfigHandler_GetConfig(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetConfigFn: func() (*config.Config, error) {
			return &config.Config{
				App: config.AppConfig{
					Theme: "kolision-raw",
				},
			}, nil
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config", nil)
	h.GetConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body config.Config
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "kolision-raw", body.App.Theme)
}

func TestConfigHandler_GetSection(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetSectionFn: func(section string) (map[string]any, error) {
			if section == "app" {
				return map[string]any{"theme": "kolision-raw", "notifications": true}, nil
			}
			return nil, errors.New("unknown section")
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/app", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"section": "app"})
	h.GetSection(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "kolision-raw", body["theme"])
}

func TestConfigHandler_GetSection_Backend_AliasRemovedNotFound(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetSectionFn: func(section string) (map[string]any, error) {
			t.Fatal("GetSection must not run for removed /config/backend alias")
			return nil, nil
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/backend", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"section": "backend"})
	h.GetSection(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestConfigHandler_PatchSection(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		UpdateConfigFn: func(section string, values map[string]any) error {
			return nil
		},
		GetSectionFn: func(section string) (map[string]any, error) {
			return map[string]any{"theme": "light"}, nil
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/app",
		testutil.JSONBody(t, map[string]any{"theme": "light"}))
	r = testutil.WithChiURLParams(r, map[string]string{"section": "app"})
	h.PatchSection(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "light", body["theme"])
}

func TestConfigHandler_PatchSection_Unknown(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		UpdateConfigFn: func(section string, values map[string]any) error {
			return errors.New("unknown section: bogus")
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/bogus",
		testutil.JSONBody(t, map[string]any{"key": "val"}))
	r = testutil.WithChiURLParams(r, map[string]string{"section": "bogus"})
	h.PatchSection(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigHandler_PatchSection_Backend_AliasRemovedNotFound(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		UpdateConfigFn: func(string, map[string]any) error {
			t.Fatal("UpdateConfig must not run for removed /config/backend alias")
			return nil
		},
	}
	h := NewConfigHandler(testController(cfg, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/backend",
		testutil.JSONBody(t, map[string]any{"transition_type": "wipe"}))
	r = testutil.WithChiURLParams(r, map[string]string{"section": "backend"})
	h.PatchSection(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// syncProbe implements backend.Backend for config handler tests, counting OnConfigChanged calls.
type syncProbe struct {
	testutil.MockBackend
	syncCalls int
	syncErr   error
}

func (s *syncProbe) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	s.syncCalls++
	return s.syncErr
}

func TestConfigHandler_GetNamedBackendConfig(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetBackendConfigFn: func(name string) (json.RawMessage, error) {
			if name == "awww" {
				return json.RawMessage(`{"resize":"fit"}`), nil
			}
			return nil, errors.New("no config")
		},
	}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			if name == "awww" {
				return &testutil.MockBackend{}, true
			}
			return nil, false
		},
	}
	h := NewConfigHandler(testController(cfg, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/backends/awww", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "awww"})
	h.GetNamedBackendConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"resize":"fit"}`, w.Body.String())
}

func TestConfigHandler_GetNamedBackendConfig_Unknown(t *testing.T) {
	h := NewConfigHandler(testController(&testutil.MockConfigManager{}, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/backends/nope", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "nope"})
	h.GetNamedBackendConfig(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestConfigHandler_PatchNamedBackendConfig_SyncOnlyWhenActive(t *testing.T) {
	sb := &syncProbe{
		MockBackend: testutil.MockBackend{
			ValidateConfigFn: func(json.RawMessage) error { return nil },
		},
	}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			if name == "wayland-utauri" {
				return sb, true
			}
			return nil, false
		},
	}
	cfgMgr := &testutil.MockConfigManager{
		GetActiveBackendTypeFn: func() string { return "awww" },
		SetBackendConfigFn:     func(string, json.RawMessage) error { return nil },
	}
	h := NewConfigHandler(testController(cfgMgr, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/backends/wayland-utauri",
		testutil.JSONBody(t, map[string]any{"parallax_enabled": true}))
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "wayland-utauri"})
	h.PatchNamedBackendConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 0, sb.syncCalls, "inactive backend must not runtime-sync")
}

func TestConfigHandler_PatchNamedBackendConfig_ActiveSyncs(t *testing.T) {
	sb := &syncProbe{
		MockBackend: testutil.MockBackend{
			ValidateConfigFn: func(json.RawMessage) error { return nil },
		},
	}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			if name == "wayland-utauri" {
				return sb, true
			}
			return nil, false
		},
	}
	cfgMgr := &testutil.MockConfigManager{
		GetActiveBackendTypeFn: func() string { return "wayland-utauri" },
		SetBackendConfigFn:     func(string, json.RawMessage) error { return nil },
	}
	h := NewConfigHandler(testController(cfgMgr, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/backends/wayland-utauri",
		testutil.JSONBody(t, map[string]any{"parallax_enabled": false}))
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "wayland-utauri"})
	h.PatchNamedBackendConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, sb.syncCalls)
}

func TestConfigHandler_PatchNamedBackendConfig_RuntimeSyncErrorStillOK(t *testing.T) {
	sb := &syncProbe{
		MockBackend: testutil.MockBackend{
			ValidateConfigFn: func(json.RawMessage) error { return nil },
		},
		syncErr: errors.New("socket down"),
	}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			if name == "wayland-utauri" {
				return sb, true
			}
			return nil, false
		},
	}
	cfgMgr := &testutil.MockConfigManager{
		GetActiveBackendTypeFn: func() string { return "wayland-utauri" },
		SetBackendConfigFn:     func(string, json.RawMessage) error { return nil },
	}
	h := NewConfigHandler(testController(cfgMgr, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/backends/wayland-utauri",
		testutil.JSONBody(t, map[string]any{"parallax_enabled": false}))
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "wayland-utauri"})
	h.PatchNamedBackendConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, sb.syncCalls)
}
