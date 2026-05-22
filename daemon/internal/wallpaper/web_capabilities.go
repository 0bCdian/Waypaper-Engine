package wallpaper

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"waypaper-engine/daemon/internal/store"
)

// MergeWebCapabilitiesJSON merges a partial JSON map (typically from PATCH) into current caps.
// Only boolean values for known capability keys are applied.
func MergeWebCapabilitiesJSON(cur store.WebCapabilities, patch map[string]any) store.WebCapabilities {
	raw, err := json.Marshal(cur)
	if err != nil {
		return cur
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return cur
	}
	for k, v := range patch {
		if b, ok := v.(bool); ok {
			m[k] = b
		}
	}
	out, err := json.Marshal(m)
	if err != nil {
		return cur
	}
	var res store.WebCapabilities
	if err := json.Unmarshal(out, &res); err != nil {
		return cur
	}
	return res
}

// WriteWebCapabilitiesToManifest writes the top-level `capabilities` object in waypaper.json.
func WriteWebCapabilitiesToManifest(manifestPath string, caps store.WebCapabilities) error {
	manifestPath = filepath.Clean(strings.TrimSpace(manifestPath))
	if manifestPath == "" || manifestPath == "." {
		return nil
	}
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return err
	}

	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return err
	}
	if root == nil {
		root = make(map[string]any)
	}

	capBytes, err := json.Marshal(caps)
	if err != nil {
		return err
	}
	var capObj map[string]any
	if err := json.Unmarshal(capBytes, &capObj); err != nil {
		return err
	}
	root["capabilities"] = capObj

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	return os.WriteFile(manifestPath, out, 0o644)
}
