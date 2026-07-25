package wallpaperhandler

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
)

// Set/Random/ClearHistory have no existing handler-level test exercising
// their response body (constructing a WallpaperHandler requires a full set
// of store/backend/monitor dependencies). Per the task's wire-format
// verification requirement, marshal each new response struct and compare
// against the exact JSON the old inline map literal produced.

func TestSetWallpaperResponse_WireFormat(t *testing.T) {
	for _, status := range []string{"set", "superseded"} {
		got, err := json.Marshal(SetWallpaperResponse{
			Status:  status,
			ImageID: 42,
			Monitor: "DP-1",
			Mode:    monitor.ModeIndividual,
		})
		require.NoError(t, err)
		want := `{"status":"` + status + `","image_id":42,"monitor":"DP-1","mode":"` + string(monitor.ModeIndividual) + `"}`
		assert.JSONEq(t, want, string(got))
	}
}

func TestRandomWallpaperResponse_WireFormat(t *testing.T) {
	for _, status := range []string{"set", "superseded"} {
		got, err := json.Marshal(RandomWallpaperResponse{
			Status:  status,
			ImageID: 42,
			Monitor: "*",
			Mode:    monitor.ModeIndividual,
		})
		require.NoError(t, err)
		want := `{"status":"` + status + `","image_id":42,"monitor":"*","mode":"` + string(monitor.ModeIndividual) + `"}`
		assert.JSONEq(t, want, string(got))
	}
}

func TestClearHistoryResponse_WireFormat(t *testing.T) {
	got, err := json.Marshal(ClearHistoryResponse{Status: "cleared"})
	require.NoError(t, err)
	assert.JSONEq(t, `{"status":"cleared"}`, string(got))
}
