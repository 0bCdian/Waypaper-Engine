package parallaxdriver

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

var hyprctlPathOnce sync.Once
var hyprctlPathResolved string

func hyprctlBinary() string {
	hyprctlPathOnce.Do(func() {
		if p, err := exec.LookPath("hyprctl"); err == nil {
			hyprctlPathResolved = p
		} else {
			hyprctlPathResolved = "hyprctl"
		}
	})
	return hyprctlPathResolved
}

// parseJSONIntish decodes a JSON value that may be number or numeric string into int.
func parseJSONIntish(raw json.RawMessage) int {
	if len(raw) == 0 {
		return 0
	}
	var n int
	if err := json.Unmarshal(raw, &n); err == nil {
		return n
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return int(f)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		v, err := strconv.Atoi(strings.TrimSpace(s))
		if err == nil {
			return v
		}
	}
	return 0
}

func parseHyprActiveWorkspaceID(raw json.RawMessage) int {
	var w struct {
		ID json.RawMessage `json:"id"`
	}
	if err := json.Unmarshal(raw, &w); err != nil {
		return 0
	}
	return parseJSONIntish(w.ID)
}

type hyprMonitorJSON struct {
	Name     string          `json:"name"`
	X        float64         `json:"x"`
	Y        float64         `json:"y"`
	Width    float64         `json:"width"`
	Height   float64         `json:"height"`
	ActiveWS json.RawMessage `json:"activeWorkspace"`
}

// parseHyprlandMonitorsJSON decodes `hyprctl -j monitors` output into MonitorWorkspaceEntry values.
func parseHyprlandMonitorsJSON(raw []byte) ([]MonitorWorkspaceEntry, error) {
	var mons []hyprMonitorJSON
	if err := json.Unmarshal(raw, &mons); err != nil {
		return nil, fmt.Errorf("decode monitors array: %w", err)
	}
	if len(mons) == 0 {
		return nil, fmt.Errorf("monitors list empty")
	}
	entries := make([]MonitorWorkspaceEntry, 0, len(mons))
	for _, m := range mons {
		if m.Width <= 0 || m.Height <= 0 {
			continue
		}
		wsID := parseHyprActiveWorkspaceID(m.ActiveWS)
		if strings.TrimSpace(m.Name) == "" {
			continue
		}
		entries = append(entries, MonitorWorkspaceEntry{
			WorkspaceID: wsID,
			Bounds:      Rect{X: m.X, Y: m.Y, Width: m.Width, Height: m.Height},
			OutputName:  m.Name,
		})
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("no monitors with positive size and name")
	}
	return entries, nil
}
