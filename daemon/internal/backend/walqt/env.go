package walqt

import (
	"fmt"
	"strings"
)

// protectedEnvKeys are environment variables the daemon owns. The user may not
// override them through backend.wal-qt.env: doing so silently breaks the
// wal-qt spawn (wrong Wayland socket, missing binary, wrong home dir, injected
// libraries) with no obvious cause. Everything else is allowed — the env map
// is an escape hatch, so it stays wide open apart from these.
var protectedEnvKeys = map[string]bool{
	"WAYLAND_DISPLAY": true,
	"XDG_RUNTIME_DIR": true,
	"DISPLAY":         true,
	"PATH":            true,
	"HOME":            true,
	"LD_PRELOAD":      true,
	"LD_LIBRARY_PATH": true,
}

// validateEnvEntries checks that every entry is a well-formed "KEY=VALUE" pair
// with a non-empty, whitespace-free key that is not in protectedEnvKeys.
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

// mergeProcessEnv returns base with the extra "KEY=VALUE" entries appended.
// os/exec deduplicates Cmd.Env keeping the last occurrence of each key, so
// appending extra after the inherited environment makes extra entries win.
// Blank entries are skipped.
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
