// Package backenddefaults registers default Viper subtrees for wallpaper backends using fresh
// Backend instances (so RegisterDefaults never mutates live registry singletons).
//
// Do not import this package from internal/config: that creates an import cycle
// (internal/backend → config → backenddefaults → backend/awww → backend).
// Callers such as internal/control pass backenddefaults.RegisterInto into
// ConfigManager.ResetToFactoryDefaults as a callback instead.
package backenddefaults

import (
	"fmt"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend/awww"
	"waypaper-engine/daemon/internal/backend/feh"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
	"waypaper-engine/daemon/internal/backend/mpvpaper"
	"waypaper-engine/daemon/internal/backend/walqt"
)

// Must match backend.WalQtBackendName (backend cannot import this package).
const walQtBackendName = "wal-qt"

// RegisterInto registers SetDefault entries for every compiled-in wallpaper backend.
func RegisterInto(v *viper.Viper) {
	awww.New().RegisterDefaults(v)
	feh.New().RegisterDefaults(v)
	hyprpaper.New().RegisterDefaults(v)
	mpvpaper.New().RegisterDefaults(v)
	walqt.New().RegisterDefaults(v)
}

// Subtree returns the default map for one backend's [backend.<name>] section.
func Subtree(backendName string) (map[string]any, error) {
	v := viper.New()
	switch backendName {
	case "awww":
		awww.New().RegisterDefaults(v)
	case "feh":
		feh.New().RegisterDefaults(v)
	case "hyprpaper":
		hyprpaper.New().RegisterDefaults(v)
	case "mpvpaper":
		mpvpaper.New().RegisterDefaults(v)
	case walQtBackendName:
		walqt.New().RegisterDefaults(v)
	default:
		return nil, fmt.Errorf("backenddefaults: unknown backend %q", backendName)
	}
	m := v.GetStringMap("backend." + backendName)
	if m == nil {
		return map[string]any{}, nil
	}
	return m, nil
}
