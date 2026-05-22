// Package pathsecure resolves manifest-relative paths against a package root and
// rejects absolute paths, lexical ".. escapes", and symlink targets outside the root.
package pathsecure

import (
	"fmt"
	"path/filepath"
	"strings"
)

// MustResolveUnder joins root with rel, verifies the cleaned path stays inside root,
// then evaluates symlinks and verifies the final path is still inside root.
// rel must be non-empty and relative (no filepath.IsAbs). The target path must exist.
func MustResolveUnder(root, rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	if rel == "" {
		return "", fmt.Errorf("manifest path is empty")
	}
	if filepath.IsAbs(rel) {
		return "", fmt.Errorf("manifest path must be relative to the package root, not absolute: %q", rel)
	}

	rootAbs, err := filepath.Abs(filepath.Clean(root))
	if err != nil {
		return "", fmt.Errorf("package root: %w", err)
	}
	rootCanon := rootAbs
	if r, err := filepath.EvalSymlinks(rootAbs); err == nil {
		rootCanon = r
	}

	joined := filepath.Join(rootCanon, rel)
	absJoined, err := filepath.Abs(filepath.Clean(joined))
	if err != nil {
		return "", err
	}
	if !isUnder(rootCanon, absJoined) {
		return "", fmt.Errorf("path escapes package root: %q", rel)
	}

	resolved, err := filepath.EvalSymlinks(absJoined)
	if err != nil {
		return "", fmt.Errorf("resolve %q: %w", rel, err)
	}
	if !isUnder(rootCanon, resolved) {
		return "", fmt.Errorf("path %q resolves outside package root (symlink)", rel)
	}

	return resolved, nil
}

func isUnder(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	if rel == ".." {
		return false
	}
	sep := string(filepath.Separator)
	return !strings.HasPrefix(rel, ".."+sep)
}
