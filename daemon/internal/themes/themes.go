// Package themes manages user-provided palette CSS files from the
// XDG config directory (~/.config/waypaper-engine/themes/).
package themes

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Theme is the metadata returned for a single user-provided palette.
type Theme struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Source      string `json:"source"` // always "user" for this package
	URL         string `json:"url"`    // /api/themes/{name}.css
}

// List enumerates *.css files in dir and returns their metadata sorted by
// name. A missing directory is treated as "no themes" (empty slice, nil error).
func List(dir string) ([]Theme, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return []Theme{}, nil
		}
		return nil, fmt.Errorf("read themes dir: %w", err)
	}

	out := make([]Theme, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".css") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".css")
		out = append(out, Theme{
			Name:        name,
			DisplayName: name,
			Source:      "user",
			URL:         "/api/themes/" + name + ".css",
		})
	}
	return out, nil
}

// Open returns a readable file for {name}.css inside dir. It rejects any path
// that escapes dir (defense against path traversal like `../../etc/passwd`).
func Open(dir, name string) (*os.File, error) {
	if name == "" || strings.ContainsAny(name, `/\`) || name == "." || name == ".." {
		return nil, fs.ErrInvalid
	}
	full := filepath.Join(dir, name+".css")
	resolved, err := filepath.EvalSymlinks(full)
	if err != nil {
		return nil, err
	}
	resolvedDir, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(resolved, resolvedDir+string(filepath.Separator)) && resolved != resolvedDir {
		return nil, fs.ErrPermission
	}
	return os.Open(resolved)
}
