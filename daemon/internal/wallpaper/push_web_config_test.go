package wallpaper

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"waypaper-engine/daemon/internal/backend"
)

// Regression: Registry.Active() returns nil in the daemon's supported no-backend
// degraded mode. These push helpers dereferenced it unguarded, so a web wallpaper
// config PATCH panicked instead of no-opping.
func TestPushToRenderer_NoActiveBackend(t *testing.T) {
	reg := backend.NewRegistry()

	assert.NotPanics(t, func() {
		assert.NoError(t, PushWallpaperConfigToRenderer(context.Background(), reg, "img:1", nil))
	})
	assert.NotPanics(t, func() {
		assert.NoError(t, PushWebCapabilitiesToRenderer(context.Background(), reg, "img:1", nil))
	})
}
