package walqt

import (
	"fmt"
	"strings"
)

var protectedEnvKeys = map[string]bool{
	"WAYLAND_DISPLAY": true,
	"XDG_RUNTIME_DIR": true,
	"DISPLAY":         true,
	"PATH":            true,
	"HOME":            true,
	"LD_PRELOAD":      true,
	"LD_LIBRARY_PATH": true,
}

func validateEnvEntries(entries []string) error {
	for _, e := range entries {
		key, _, ok := strings.Cut(e, "=")
		if !ok {
			return fmt.Errorf("env entry %q must be in KEY=VALUE form", e)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return fmt.Errorf("env entry %q has an empty key", e)
		}
		if strings.ContainsAny(key, " \t") {
			return fmt.Errorf("env key %q must not contain whitespace", key)
		}
		if protectedEnvKeys[strings.ToUpper(key)] {
			return fmt.Errorf("%s is managed by waypaper and cannot be overridden", key)
		}
	}
	return nil
}

func mergeProcessEnv(base, extra []string) []string {
	if len(extra) == 0 {
		return base
	}
	merged := make([]string, 0, len(base)+len(extra))
	merged = append(merged, base...)
	for _, e := range extra {
		if strings.TrimSpace(e) == "" {
			continue
		}
		merged = append(merged, e)
	}
	return merged
}
