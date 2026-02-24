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

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/testutil"
)

func TestMonitorHandler_List(t *testing.T) {
	mm := &testutil.MockMonitorManager{
		RefreshFn: func(_ context.Context) error { return nil },
		GetMonitorsFn: func(_ context.Context) ([]monitor.Monitor, error) {
			return []monitor.Monitor{
				{Name: "HDMI-A-1", Width: 1920, Height: 1080},
				{Name: "DP-1", Width: 2560, Height: 1440},
			}, nil
		},
	}
	h := NewMonitorHandler(mm)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/monitors", nil)
	h.List(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var monitors []monitor.Monitor
	require.NoError(t, json.NewDecoder(w.Body).Decode(&monitors))
	assert.Len(t, monitors, 2)
	assert.Equal(t, "HDMI-A-1", monitors[0].Name)
}

func TestMonitorHandler_Get_Found(t *testing.T) {
	mm := &testutil.MockMonitorManager{
		GetMonitorByNameFn: func(_ context.Context, name string) (monitor.Monitor, error) {
			return monitor.Monitor{Name: name, Width: 1920, Height: 1080}, nil
		},
	}
	h := NewMonitorHandler(mm)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/monitors/HDMI-A-1", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"name": "HDMI-A-1"})
	h.Get(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var mon monitor.Monitor
	require.NoError(t, json.NewDecoder(w.Body).Decode(&mon))
	assert.Equal(t, "HDMI-A-1", mon.Name)
}

func TestMonitorHandler_Get_NotFound(t *testing.T) {
	mm := &testutil.MockMonitorManager{
		GetMonitorByNameFn: func(_ context.Context, name string) (monitor.Monitor, error) {
			return monitor.Monitor{}, errors.New("monitor not found")
		},
	}
	h := NewMonitorHandler(mm)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/monitors/FAKE-1", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"name": "FAKE-1"})
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
