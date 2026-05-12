package confighandler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/spf13/viper"
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

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	app, ok := body["app"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "kolision-raw", app["theme"])
}

func TestConfigHandler_GetConfig_MergesBackendSections(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetConfigFn: func() (*config.Config, error) {
			return &config.Config{
				Backend: config.BackendSection{
					Type: "awww",
				},
			}, nil
		},
		GetBackendConfigFn: func(name string) (json.RawMessage, error) {
			if name == "awww" {
				return json.RawMessage(`{"transition_fps":60,"transition_step":90}`), nil
			}
			return json.RawMessage(`{}`), nil
		},
	}
	reg := &testutil.MockRegistry{
		AvailableFn: func() []backend.BackendInfo {
			return []backend.BackendInfo{{Name: "awww"}, {Name: "feh"}}
		},
	}
	h := NewConfigHandler(testController(cfg, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config", nil)
	h.GetConfig(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	b, ok := body["backend"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "awww", b["type"])
	awww, ok := b["awww"].(map[string]any)
	require.True(t, ok)
	assert.EqualValues(t, 60, awww["transition_fps"])
	assert.EqualValues(t, 90, awww["transition_step"])
	feh, ok := b["feh"].(map[string]any)
	require.True(t, ok)
	assert.Len(t, feh, 0)
}

func TestConfigHandler_GetConfig_TransitionDurationCanonOverlay(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetConfigFn: func() (*config.Config, error) {
			return &config.Config{
				Backend: config.BackendSection{
					Type:                      "awww",
					TransitionDurationSeconds: 2.5,
				},
			}, nil
		},
		GetBackendConfigFn: func(name string) (json.RawMessage, error) {
			switch name {
			case "awww":
				return json.RawMessage(`{"transition_duration":9}`), nil
			case "wayland-utauri":
				return json.RawMessage(`{"duration_ms":999}`), nil
			default:
				return json.RawMessage(`{}`), nil
			}
		},
	}
	reg := &testutil.MockRegistry{
		AvailableFn: func() []backend.BackendInfo {
			return []backend.BackendInfo{{Name: "awww"}, {Name: "wayland-utauri"}}
		},
	}
	h := NewConfigHandler(testController(cfg, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config", nil)
	h.GetConfig(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	b := body["backend"].(map[string]any)
	awww := b["awww"].(map[string]any)
	assert.InDelta(t, 2.5, awww["transition_duration"], 1e-9)
	wut := b["wayland-utauri"].(map[string]any)
	assert.EqualValues(t, 2500, wut["duration_ms"])
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

func TestConfigHandler_PostResetNamedBackend_Unknown(t *testing.T) {
	h := NewConfigHandler(testController(&testutil.MockConfigManager{}, &testutil.MockRegistry{}, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/config/backends/nope/reset", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "nope"})
	h.PostResetNamedBackendConfig(w, r)

	require.Equal(t, http.StatusNotFound, w.Code)
}

func TestConfigHandler_PostResetNamedBackend_SuccessWritesSingleJSONValue(t *testing.T) {
	fehBackend := &testutil.MockBackend{NameFn: func() string { return "feh" }}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			return fehBackend, name == "feh"
		},
	}
	var replaced string
	cfg := &testutil.MockConfigManager{
		GetActiveBackendTypeFn: func() string { return "awww" },
		ReplaceBackendNamedConfigFn: func(backendName string, values map[string]any) error {
			replaced = backendName
			assert.NotEmpty(t, values)
			return nil
		},
	}
	h := NewConfigHandler(testController(cfg, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/config/backends/feh/reset", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"backend": "feh"})
	h.PostResetNamedBackendConfig(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "feh", replaced)

	raw := strings.TrimSpace(w.Body.String())
	dec := json.NewDecoder(strings.NewReader(raw))
	var body map[string]string
	require.NoError(t, dec.Decode(&body))
	require.Equal(t, "reset", body["status"])
	var extra any
	err := dec.Decode(&extra)
	require.ErrorIs(t, err, io.EOF)
}

func TestConfigHandler_PostResetAll_InvokesFactoryReset(t *testing.T) {
	var resetCalls int
	cfg := &testutil.MockConfigManager{
		ResetToFactoryDefaultsFn: func(func(*viper.Viper)) error {
			resetCalls++
			return nil
		},
		GetConfigFn: func() (*config.Config, error) {
			return &config.Config{}, nil
		},
		GetBackendConfigFn: func(string) (json.RawMessage, error) {
			return json.RawMessage(`{}`), nil
		},
		GetActiveBackendTypeFn: func() string { return "awww" },
	}

	mb := &testutil.MockBackend{NameFn: func() string { return "awww" }}
	reg := &testutil.MockRegistry{
		GetFn: func(name string) (backend.Backend, bool) {
			return mb, name == "awww"
		},
		ActiveFn: func() backend.Backend { return mb },
	}

	h := NewConfigHandler(testController(cfg, reg, &testutil.MockBus{}))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/config/reset", nil)
	h.PostResetAll(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, 1, resetCalls)
}
