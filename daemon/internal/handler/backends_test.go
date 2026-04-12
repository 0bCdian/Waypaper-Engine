package handler

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
	"waypaper-engine/daemon/internal/testutil"
)

func TestBackendHandler_List(t *testing.T) {
	reg := &testutil.MockRegistry{
		AvailableFn: func() []backend.BackendInfo {
			return []backend.BackendInfo{
				{Name: "awww", Available: true, Active: true},
				{Name: "swaybg", Available: true, Active: false},
			}
		},
	}
	h := NewBackendHandler(reg, &testutil.MockConfigManager{}, &testutil.MockBus{},
		&testutil.MockMonitorStateStore{}, &testutil.MockStateStore{}, &testutil.MockImageStore{},
		&testutil.MockMonitorManager{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/backends", nil)
	h.List(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var infos []backend.BackendInfo
	require.NoError(t, json.NewDecoder(w.Body).Decode(&infos))
	assert.Len(t, infos, 2)
	assert.Equal(t, "awww", infos[0].Name)
}

func TestBackendHandler_Activate_NotRegistered(t *testing.T) {
	mockBackend := &testutil.MockBackend{
		NameFn:     func() string { return "awww" },
		ShutdownFn: func(_ context.Context) error { return nil },
	}
	reg := &testutil.MockRegistry{
		ActiveFn: func() backend.Backend { return mockBackend },
		SetActiveFn: func(name string) error {
			return errors.New("backend not registered: " + name)
		},
	}
	h := NewBackendHandler(reg, &testutil.MockConfigManager{}, &testutil.MockBus{},
		&testutil.MockMonitorStateStore{}, &testutil.MockStateStore{}, &testutil.MockImageStore{},
		&testutil.MockMonitorManager{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/backends/unknown/activate", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"name": "unknown"})
	h.Activate(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var apiErr APIError
	require.NoError(t, json.NewDecoder(w.Body).Decode(&apiErr))
	assert.Contains(t, apiErr.Error, "not registered")
}

func TestBackendHandler_Activate_InitializeFailureRollsBack(t *testing.T) {
	prevBackend := &testutil.MockBackend{
		NameFn: func() string { return "awww" },
		InitializeFn: func(_ context.Context) error {
			return nil
		},
		ShutdownFn: func(_ context.Context) error { return nil },
	}
	nextBackend := &testutil.MockBackend{
		NameFn: func() string { return "feh" },
		InitializeFn: func(_ context.Context) error {
			return errors.New("boom")
		},
	}

	activeName := "awww"
	setActiveCalls := make([]string, 0, 2)
	reg := &testutil.MockRegistry{
		ActiveFn: func() backend.Backend {
			if activeName == "feh" {
				return nextBackend
			}
			return prevBackend
		},
		SetActiveFn: func(name string) error {
			setActiveCalls = append(setActiveCalls, name)
			activeName = name
			return nil
		},
	}

	h := NewBackendHandler(reg, &testutil.MockConfigManager{}, &testutil.MockBus{},
		&testutil.MockMonitorStateStore{}, &testutil.MockStateStore{}, &testutil.MockImageStore{},
		&testutil.MockMonitorManager{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/backends/feh/activate", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"name": "feh"})
	h.Activate(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Equal(t, "awww", activeName, "active backend should be rolled back")
	assert.Equal(t, []string{"feh", "awww"}, setActiveCalls)

	var apiErr APIError
	require.NoError(t, json.NewDecoder(w.Body).Decode(&apiErr))
	assert.Contains(t, apiErr.Error, "activate backend feh")
}
