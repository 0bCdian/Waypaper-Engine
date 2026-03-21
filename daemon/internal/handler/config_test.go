package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/testutil"
)

func TestConfigHandler_GetConfig(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetConfigFn: func() (*config.Config, error) {
			return &config.Config{
				App: config.AppConfig{
					Theme: "dark",
				},
			}, nil
		},
	}
	h := NewConfigHandler(cfg, &testutil.MockRegistry{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config", nil)
	h.GetConfig(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body config.Config
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "dark", body.App.Theme)
}

func TestConfigHandler_GetSection(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetSectionFn: func(section string) (map[string]any, error) {
			if section == "app" {
				return map[string]any{"theme": "dark", "notifications": true}, nil
			}
			return nil, errors.New("unknown section")
		},
	}
	h := NewConfigHandler(cfg, &testutil.MockRegistry{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/app", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"section": "app"})
	h.GetSection(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "dark", body["theme"])
}

func TestConfigHandler_GetSection_Backend(t *testing.T) {
	cfg := &testutil.MockConfigManager{
		GetActiveBackendTypeFn: func() string { return "awww" },
		GetBackendConfigFn: func(name string) (json.RawMessage, error) {
			return json.RawMessage(`{"transition":"fade"}`), nil
		},
	}
	h := NewConfigHandler(cfg, &testutil.MockRegistry{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/config/backend", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"section": "backend"})
	h.GetSection(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"transition":"fade"}`, w.Body.String())
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
	h := NewConfigHandler(cfg, &testutil.MockRegistry{}, &testutil.MockBus{})

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
	h := NewConfigHandler(cfg, &testutil.MockRegistry{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/config/bogus",
		testutil.JSONBody(t, map[string]any{"key": "val"}))
	r = testutil.WithChiURLParams(r, map[string]string{"section": "bogus"})
	h.PatchSection(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
