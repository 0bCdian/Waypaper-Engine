package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDetectCompositor_Wayland(t *testing.T) {
	t.Setenv("XDG_SESSION_TYPE", "wayland")
	assert.Equal(t, CompositorWayland, DetectCompositor())
}

func TestDetectCompositor_X11(t *testing.T) {
	t.Setenv("XDG_SESSION_TYPE", "x11")
	assert.Equal(t, CompositorX11, DetectCompositor())
}

func TestDetectCompositor_WaylandDisplay(t *testing.T) {
	t.Setenv("XDG_SESSION_TYPE", "")
	t.Setenv("WAYLAND_DISPLAY", "wayland-0")
	assert.Equal(t, CompositorWayland, DetectCompositor())
}

func TestDetectCompositor_DefaultWayland(t *testing.T) {
	t.Setenv("XDG_SESSION_TYPE", "")
	t.Setenv("WAYLAND_DISPLAY", "")
	t.Setenv("DISPLAY", "")
	assert.Equal(t, CompositorWayland, DetectCompositor())
}
