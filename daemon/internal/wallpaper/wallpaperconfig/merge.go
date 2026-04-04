package wallpaperconfig

import (
	"encoding/json"
	"fmt"
)

// MergeValues builds the effective config map: each key from schema gets its "default",
// then keys present in overrides replace values (only for keys defined in schema).
func MergeValues(schemaJSON, overridesJSON json.RawMessage) (json.RawMessage, error) {
	if len(schemaJSON) == 0 {
		return []byte("{}"), nil
	}
	var schema map[string]map[string]any
	if err := json.Unmarshal(schemaJSON, &schema); err != nil {
		return nil, fmt.Errorf("wallpaper_config: parse schema: %w", err)
	}
	out := make(map[string]any, len(schema))
	for id, prop := range schema {
		if def, ok := prop["default"]; ok {
			out[id] = def
		}
	}
	if len(overridesJSON) > 0 {
		var over map[string]any
		if err := json.Unmarshal(overridesJSON, &over); err != nil {
			return nil, fmt.Errorf("wallpaper_config_overrides: parse: %w", err)
		}
		for k, v := range over {
			if _, defined := schema[k]; defined {
				out[k] = v
			}
		}
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	return raw, nil
}
