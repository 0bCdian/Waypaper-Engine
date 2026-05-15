package shadowtest

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
)

// HyprpaperCaptor captures the rendered hyprpaper.conf file from a temp dir.
type HyprpaperCaptor struct {
	confPath string // ${tmp}/hyprpaper.conf
	backend  backend.Backend
}

// NewHyprpaperCaptor builds a Hyprpaper backend pointing at a tempdir conf path.
// The captor reads the conf file after each backend call to capture its rendered output.
func NewHyprpaperCaptor(t *testing.T) *HyprpaperCaptor {
	t.Helper()
	dir := t.TempDir()
	confPath := filepath.Join(dir, "hyprpaper.conf")

	v := viper.New()
	v.Set("backend.hyprpaper.config_path", confPath)
	v.Set("backend.hyprpaper.fit_mode", "cover")

	b := hyprpaper.New()
	b.RegisterDefaults(v)

	return &HyprpaperCaptor{confPath: confPath, backend: b}
}

func (c *HyprpaperCaptor) readConf(t *testing.T) []byte {
	t.Helper()
	data, err := os.ReadFile(c.confPath)
	if err != nil {
		return []byte("<no conf written: " + err.Error() + ">")
	}
	return data
}

func (c *HyprpaperCaptor) CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte {
	t.Helper()
	_ = c.backend.SetWallpaper(t.Context(), req)
	return c.readConf(t)
}

func (c *HyprpaperCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	_ = c.backend.Apply(t.Context(), snap)
	return c.readConf(t)
}
