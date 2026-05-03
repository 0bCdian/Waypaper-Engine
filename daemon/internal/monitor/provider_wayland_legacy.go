package monitor

/*
#cgo LDFLAGS: -lwayland-client

#include <stdlib.h>
#include <string.h>
#include <wayland-client.h>

// Struct to pass data back to Go
typedef struct {
    char name[32];
    int x;
    int y;
    int width;
    int height;
    float scale;
    float refresh;
    int transform;
} CMonitorLegacy;

typedef struct {
    CMonitorLegacy monitors[32];
    int count;
} CMonitorListLegacy;

// Callback for output events
static void legacy_output_geometry(void *data, struct wl_output *wl_output, int32_t x, int32_t y,
                          int32_t physical_width, int32_t physical_height, int32_t subpixel,
                          const char *make, const char *model, int32_t transform) {
    CMonitorLegacy *m = (CMonitorLegacy *)data;
    m->x = x;
    m->y = y;
    m->transform = transform;
}

static void legacy_output_mode(void *data, struct wl_output *wl_output, uint32_t flags,
                      int32_t width, int32_t height, int32_t refresh) {
    CMonitorLegacy *m = (CMonitorLegacy *)data;
    if (flags & WL_OUTPUT_MODE_CURRENT) {
        m->width = width;
        m->height = height;
        m->refresh = (float)refresh / 1000.0;
    }
}

static void legacy_output_done(void *data, struct wl_output *wl_output) {}

static void legacy_output_scale(void *data, struct wl_output *wl_output, int32_t factor) {
    CMonitorLegacy *m = (CMonitorLegacy *)data;
    m->scale = (float)factor;
}

static void legacy_output_name(void *data, struct wl_output *wl_output, const char *name) {
    CMonitorLegacy *m = (CMonitorLegacy *)data;
    strncpy(m->name, name, 31);
}

static void legacy_output_description(void *data, struct wl_output *wl_output, const char *description) {}

static const struct wl_output_listener legacy_output_listener = {
    legacy_output_geometry,
    legacy_output_mode,
    legacy_output_done,
    legacy_output_scale,
    legacy_output_name,
    legacy_output_description,
};

static void legacy_registry_handle_global(void *data, struct wl_registry *registry, uint32_t id,
                                 const char *interface, uint32_t version) {
    CMonitorListLegacy *list = (CMonitorListLegacy *)data;
    if (strcmp(interface, "wl_output") == 0 && list->count < 32) {
        CMonitorLegacy *m = &list->monitors[list->count++];
        m->scale = 1.0; // Default
        struct wl_output *output = wl_registry_bind(registry, id, &wl_output_interface, version < 4 ? version : 4);
        wl_output_add_listener(output, &legacy_output_listener, m);
    }
}

static void legacy_registry_handle_global_remove(void *data, struct wl_registry *registry, uint32_t id) {}

static const struct wl_registry_listener legacy_registry_listener = {
    legacy_registry_handle_global,
    legacy_registry_handle_global_remove,
};

// Main entry point for C
static int collect_monitors_legacy(CMonitorListLegacy *list) {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return -1;

    list->count = 0;
    struct wl_registry *registry = wl_display_get_registry(display);
    wl_registry_add_listener(registry, &legacy_registry_listener, list);

    // Sync 1: Get globals
    wl_display_roundtrip(display);
    // Sync 2: Get output events
    wl_display_roundtrip(display);

    wl_registry_destroy(registry);
    wl_display_disconnect(display);
    return 0;
}
*/
import "C"

import (
	"context"
	"fmt"
	"os"
	"strings"
)

// waylandLegacyProvider queries monitor information using only the core wl_output
// protocol. It is a fallback for compositors that don't expose
// wlr-output-management-unstable-v1 (e.g. GNOME/Mutter).
//
// Limitations versus the wlr provider:
//   - x/y from wl_output.geometry is unreliable on wlroots compositors
//     (Hyprland reports 0,0). For accurate logical layout, prefer the wlr
//     provider.
//   - scale is integer-only; fractional scales (1.25, 1.5) round to nearest int.
//   - description, make, model, serial, physical size, enabled, adaptive_sync
//     are not populated.
type waylandLegacyProvider struct{}

// NewWaylandLegacyProvider returns a fallback Wayland MonitorProvider backed by
// the core wl_output protocol. Use NewWaylandProvider for the preferred
// wlr-output-management-based provider.
func NewWaylandLegacyProvider() MonitorProvider {
	return &waylandLegacyProvider{}
}

func (p *waylandLegacyProvider) Name() string               { return "wayland-wl-output" }
func (p *waylandLegacyProvider) Compositor() CompositorType { return CompositorWayland }
func (p *waylandLegacyProvider) Priority() int              { return 5 }

func (p *waylandLegacyProvider) Detect(ctx context.Context) ([]Monitor, error) {
	if os.Getenv("WAYLAND_DISPLAY") == "" {
		return nil, fmt.Errorf("%w: WAYLAND_DISPLAY not set", ErrProviderNotApplicable)
	}

	var list C.CMonitorListLegacy
	res := C.collect_monitors_legacy(&list)
	if res != 0 {
		return nil, fmt.Errorf("wl_output: failed to connect to display")
	}

	monitors := make([]Monitor, 0, int(list.count))
	for i := 0; i < int(list.count); i++ {
		cm := list.monitors[i]

		// If width is 0, we didn't get valid mode events.
		if cm.width == 0 {
			continue
		}

		name := C.GoString(&cm.name[0])
		if name == "" {
			name = fmt.Sprintf("Unknown-%d", i)
		}

		monitors = append(monitors, Monitor{
			Name:        strings.TrimSpace(name),
			Width:       int(cm.width),
			Height:      int(cm.height),
			X:           int(cm.x),
			Y:           int(cm.y),
			Scale:       float64(cm.scale),
			RefreshRate: float64(cm.refresh),
			Transform:   int(cm.transform),
			Enabled:     true,
		})
	}

	return monitors, nil
}
