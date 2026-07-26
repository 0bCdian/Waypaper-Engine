package backend

import (
	"context"
	"encoding/json"
	"strings"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

const WalQtBackendName = "wal-qt"

type Backend interface {
	Name() string
	IsAvailable() bool
	Capabilities() Capabilities
	Initialize(ctx context.Context) error
	Shutdown(ctx context.Context) error
	Apply(ctx context.Context, snap Snapshot) error
	RegisterDefaults(v *viper.Viper)
	ValidateConfig(raw json.RawMessage) error
}

type ConfigReader interface {
	GetString(key string) string
	GetInt(key string) int
	GetFloat64(key string) float64
	GetBool(key string) bool
	GetStringSlice(key string) []string
	IsSet(key string) bool
}

type ConfigReaderReceiver interface {
	SetConfigReader(r ConfigReader)
}

type Capabilities struct {
	ContentKinds []ContentKind            `json:"content_kinds"`
	Compositors  []monitor.CompositorType `json:"compositors"`
}

func SupportsMedia(caps Capabilities, mediaType string) bool {
	kind := mediaTypeToContentKind(strings.ToLower(strings.TrimSpace(mediaType)))
	for _, k := range caps.ContentKinds {
		if k == kind {
			return true
		}
	}
	return false
}

func mediaTypeToContentKind(mt string) ContentKind {
	switch mt {
	case "gif":
		return KindGIF
	case "video":
		return KindVideo
	case "web":
		return KindWebWallpaper
	default:
		return KindStaticImage
	}
}

func UnmarshalValidateConfig[T any](raw json.RawMessage) error {
	var cfg T
	return json.Unmarshal(raw, &cfg)
}
