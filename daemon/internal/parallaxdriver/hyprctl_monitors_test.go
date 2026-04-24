package parallaxdriver

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseJSONIntish(t *testing.T) {
	raw, _ := json.Marshal(7)
	require.Equal(t, 7, parseJSONIntish(raw))

	raw, _ = json.Marshal(7.0)
	require.Equal(t, 7, parseJSONIntish(raw))

	raw, _ = json.Marshal("12")
	require.Equal(t, 12, parseJSONIntish(raw))
}

func TestParseHyprlandMonitorsJSON(t *testing.T) {
	raw := []byte(`[{
		"name": "DP-1",
		"x": 0,
		"y": 0,
		"width": 1920,
		"height": 1080,
		"activeWorkspace": { "id": 5, "name": "5" }
	}]`)
	entries, err := parseHyprlandMonitorsJSON(raw)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	require.Equal(t, "DP-1", entries[0].OutputName)
	require.Equal(t, 5, entries[0].WorkspaceID)
	require.InDelta(t, 1920.0, entries[0].Bounds.Width, 1e-9)
}

func TestParseHyprlandMonitorsJSON_idAsString(t *testing.T) {
	raw := []byte(`[{
		"name": "HDMI-A-1",
		"x": 1920,
		"y": 0,
		"width": 2560,
		"height": 1440,
		"activeWorkspace": { "id": "3", "name": "III" }
	}]`)
	entries, err := parseHyprlandMonitorsJSON(raw)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	require.Equal(t, 3, entries[0].WorkspaceID)
}
