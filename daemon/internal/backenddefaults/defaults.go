package backenddefaults

import (
	"fmt"
	"waypaper-engine/daemon/internal/backend/awww"
	"waypaper-engine/daemon/internal/backend/feh"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
	"waypaper-engine/daemon/internal/backend/mpvpaper"
	"waypaper-engine/daemon/internal/backend/swaybg"
	"waypaper-engine/daemon/internal/backend/walqt"

	"github.com/spf13/viper"
)

const walQtBackendName = "wal-qt"

func RegisterInto(v *viper.Viper) {
	awww.New().RegisterDefaults(v)
	feh.New().RegisterDefaults(v)
	hyprpaper.New().RegisterDefaults(v)
	mpvpaper.New().RegisterDefaults(v)
	swaybg.New().RegisterDefaults(v)
	walqt.New().RegisterDefaults(v)
}

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
	case "swaybg":
		swaybg.New().RegisterDefaults(v)
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
