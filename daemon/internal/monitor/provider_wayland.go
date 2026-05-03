package monitor

/*
#cgo LDFLAGS: -lwayland-client

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <wayland-client.h>

#include "wlr-output-management-unstable-v1-client-protocol.h"

#define WLR_MAX_HEADS  16
#define WLR_MAX_MODES  64
#define WLR_NAME_LEN   64
#define WLR_DESC_LEN   256
#define WLR_FIELD_LEN  128

typedef struct {
    struct zwlr_output_mode_v1 *wlr_mode;
    int32_t width;
    int32_t height;
    int32_t refresh; // mHz
} CWlrMode;

typedef struct {
    char name[WLR_NAME_LEN];
    char description[WLR_DESC_LEN];
    char make[WLR_FIELD_LEN];
    char model[WLR_FIELD_LEN];
    char serial[WLR_FIELD_LEN];
    int32_t phys_width;
    int32_t phys_height;
    int32_t enabled;
    int32_t x;
    int32_t y;
    int32_t transform;
    double  scale;
    int32_t adaptive_sync;
    CWlrMode modes[WLR_MAX_MODES];
    int32_t mode_count;
    struct zwlr_output_mode_v1 *current_mode;
    int32_t current_mode_index; // resolved from current_mode pointer; -1 when none
    struct zwlr_output_head_v1 *wlr_head;
    int32_t finished; // head went away
} CWlrHead;

typedef struct {
    CWlrHead heads[WLR_MAX_HEADS];
    int32_t head_count;
    struct zwlr_output_manager_v1 *manager;
    uint32_t manager_version;
    int32_t manager_done;
    int32_t failed;
} CWlrState;

// --- mode listener -------------------------------------------------------

static void wlr_mode_handle_size(void *data, struct zwlr_output_mode_v1 *m,
                                 int32_t width, int32_t height) {
    CWlrMode *mode = (CWlrMode *)data;
    mode->width = width;
    mode->height = height;
}

static void wlr_mode_handle_refresh(void *data, struct zwlr_output_mode_v1 *m,
                                    int32_t refresh) {
    CWlrMode *mode = (CWlrMode *)data;
    mode->refresh = refresh;
}

static void wlr_mode_handle_preferred(void *data, struct zwlr_output_mode_v1 *m) {}

static void wlr_mode_handle_finished(void *data, struct zwlr_output_mode_v1 *m) {
    // Mode object went away; we just stop using it. The slot stays valid
    // because it's part of the head's static array, but mark its pointer null
    // so a stale current_mode pointer can't match.
    CWlrMode *mode = (CWlrMode *)data;
    mode->wlr_mode = NULL;
}

static const struct zwlr_output_mode_v1_listener wlr_mode_listener = {
    .size      = wlr_mode_handle_size,
    .refresh   = wlr_mode_handle_refresh,
    .preferred = wlr_mode_handle_preferred,
    .finished  = wlr_mode_handle_finished,
};

// --- head listener -------------------------------------------------------

static void copy_str(char *dst, size_t cap, const char *src) {
    if (src == NULL) {
        dst[0] = '\0';
        return;
    }
    strncpy(dst, src, cap - 1);
    dst[cap - 1] = '\0';
}

static void wlr_head_handle_name(void *data, struct zwlr_output_head_v1 *h, const char *name) {
    CWlrHead *head = (CWlrHead *)data;
    copy_str(head->name, WLR_NAME_LEN, name);
}

static void wlr_head_handle_description(void *data, struct zwlr_output_head_v1 *h, const char *description) {
    CWlrHead *head = (CWlrHead *)data;
    copy_str(head->description, WLR_DESC_LEN, description);
}

static void wlr_head_handle_physical_size(void *data, struct zwlr_output_head_v1 *h,
                                          int32_t width, int32_t height) {
    CWlrHead *head = (CWlrHead *)data;
    head->phys_width = width;
    head->phys_height = height;
}

static void wlr_head_handle_mode(void *data, struct zwlr_output_head_v1 *h,
                                 struct zwlr_output_mode_v1 *wlr_mode) {
    CWlrHead *head = (CWlrHead *)data;
    if (head->mode_count >= WLR_MAX_MODES) {
        // Out of slots — still attach a no-op listener? Better: ignore extra
        // modes; current_mode will fail to match for them but rarely will the
        // current mode be past slot 64.
        return;
    }
    CWlrMode *slot = &head->modes[head->mode_count++];
    slot->wlr_mode = wlr_mode;
    slot->width = 0;
    slot->height = 0;
    slot->refresh = 0;
    zwlr_output_mode_v1_add_listener(wlr_mode, &wlr_mode_listener, slot);
}

static void wlr_head_handle_enabled(void *data, struct zwlr_output_head_v1 *h, int32_t enabled) {
    CWlrHead *head = (CWlrHead *)data;
    head->enabled = enabled ? 1 : 0;
    if (!enabled) {
        head->current_mode = NULL;
    }
}

static void wlr_head_handle_current_mode(void *data, struct zwlr_output_head_v1 *h,
                                         struct zwlr_output_mode_v1 *wlr_mode) {
    CWlrHead *head = (CWlrHead *)data;
    head->current_mode = wlr_mode;
}

static void wlr_head_handle_position(void *data, struct zwlr_output_head_v1 *h,
                                     int32_t x, int32_t y) {
    CWlrHead *head = (CWlrHead *)data;
    head->x = x;
    head->y = y;
}

static void wlr_head_handle_transform(void *data, struct zwlr_output_head_v1 *h, int32_t transform) {
    CWlrHead *head = (CWlrHead *)data;
    head->transform = transform;
}

static void wlr_head_handle_scale(void *data, struct zwlr_output_head_v1 *h, wl_fixed_t scale) {
    CWlrHead *head = (CWlrHead *)data;
    head->scale = wl_fixed_to_double(scale);
}

static void wlr_head_handle_finished(void *data, struct zwlr_output_head_v1 *h) {
    CWlrHead *head = (CWlrHead *)data;
    head->finished = 1;
}

static void wlr_head_handle_make(void *data, struct zwlr_output_head_v1 *h, const char *make) {
    CWlrHead *head = (CWlrHead *)data;
    copy_str(head->make, WLR_FIELD_LEN, make);
}

static void wlr_head_handle_model(void *data, struct zwlr_output_head_v1 *h, const char *model) {
    CWlrHead *head = (CWlrHead *)data;
    copy_str(head->model, WLR_FIELD_LEN, model);
}

static void wlr_head_handle_serial_number(void *data, struct zwlr_output_head_v1 *h, const char *serial) {
    CWlrHead *head = (CWlrHead *)data;
    copy_str(head->serial, WLR_FIELD_LEN, serial);
}

static void wlr_head_handle_adaptive_sync(void *data, struct zwlr_output_head_v1 *h, uint32_t state) {
    CWlrHead *head = (CWlrHead *)data;
    head->adaptive_sync = (state == ZWLR_OUTPUT_HEAD_V1_ADAPTIVE_SYNC_STATE_ENABLED) ? 1 : 0;
}

static const struct zwlr_output_head_v1_listener wlr_head_listener = {
    .name           = wlr_head_handle_name,
    .description    = wlr_head_handle_description,
    .physical_size  = wlr_head_handle_physical_size,
    .mode           = wlr_head_handle_mode,
    .enabled        = wlr_head_handle_enabled,
    .current_mode   = wlr_head_handle_current_mode,
    .position       = wlr_head_handle_position,
    .transform      = wlr_head_handle_transform,
    .scale          = wlr_head_handle_scale,
    .finished       = wlr_head_handle_finished,
    .make           = wlr_head_handle_make,
    .model          = wlr_head_handle_model,
    .serial_number  = wlr_head_handle_serial_number,
    .adaptive_sync  = wlr_head_handle_adaptive_sync,
};

// --- manager listener ----------------------------------------------------

static void wlr_manager_handle_head(void *data, struct zwlr_output_manager_v1 *manager,
                                    struct zwlr_output_head_v1 *wlr_head) {
    CWlrState *st = (CWlrState *)data;
    if (st->head_count >= WLR_MAX_HEADS) {
        return;
    }
    CWlrHead *head = &st->heads[st->head_count++];
    memset(head, 0, sizeof(*head));
    head->wlr_head = wlr_head;
    head->scale = 1.0;
    head->enabled = 1; // default; will be overwritten by enabled event
    zwlr_output_head_v1_add_listener(wlr_head, &wlr_head_listener, head);
}

static void wlr_manager_handle_done(void *data, struct zwlr_output_manager_v1 *manager,
                                    uint32_t serial) {
    CWlrState *st = (CWlrState *)data;
    st->manager_done = 1;
}

static void wlr_manager_handle_finished(void *data, struct zwlr_output_manager_v1 *manager) {
    // Server is going away.
}

static const struct zwlr_output_manager_v1_listener wlr_manager_listener = {
    .head     = wlr_manager_handle_head,
    .done     = wlr_manager_handle_done,
    .finished = wlr_manager_handle_finished,
};

// --- registry listener ---------------------------------------------------

static void wlr_registry_handle_global(void *data, struct wl_registry *registry,
                                       uint32_t name, const char *interface, uint32_t version) {
    CWlrState *st = (CWlrState *)data;
    if (strcmp(interface, zwlr_output_manager_v1_interface.name) == 0) {
        uint32_t bind_version = version <= 4 ? version : 4;
        st->manager_version = bind_version;
        st->manager = wl_registry_bind(registry, name,
            &zwlr_output_manager_v1_interface, bind_version);
        zwlr_output_manager_v1_add_listener(st->manager, &wlr_manager_listener, st);
    }
}

static void wlr_registry_handle_global_remove(void *data, struct wl_registry *registry, uint32_t name) {}

static const struct wl_registry_listener wlr_registry_listener = {
    .global        = wlr_registry_handle_global,
    .global_remove = wlr_registry_handle_global_remove,
};

// --- entry point ---------------------------------------------------------

// Return codes:
//   0   ok, snapshot in state->heads[0..head_count]
//  -1   wl_display_connect failed
//  -2   compositor doesn't expose zwlr_output_manager_v1
//  -3   dispatch failed before snapshot completed
static int collect_monitors_wlr(CWlrState *state) {
    memset(state, 0, sizeof(*state));

    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return -1;

    struct wl_registry *registry = wl_display_get_registry(display);
    wl_registry_add_listener(registry, &wlr_registry_listener, state);

    // First roundtrip: discover globals and bind manager (if available).
    if (wl_display_roundtrip(display) < 0) {
        wl_registry_destroy(registry);
        wl_display_disconnect(display);
        return -3;
    }

    if (state->manager == NULL) {
        wl_registry_destroy(registry);
        wl_display_disconnect(display);
        return -2;
    }

    // Dispatch until the manager emits its initial done event. After done, the
    // entire snapshot (heads + their modes + properties) has been delivered.
    while (!state->manager_done) {
        if (wl_display_dispatch(display) < 0) {
            state->failed = 1;
            break;
        }
    }

    // Resolve current_mode pointer to an index into each head's modes array.
    // Doing this in C means the Go side never has to handle wayland proxy
    // pointers — the snapshot is fully self-contained on indices.
    for (int32_t i = 0; i < state->head_count; i++) {
        CWlrHead *h = &state->heads[i];
        h->current_mode_index = -1;
        if (h->current_mode == NULL) continue;
        for (int32_t j = 0; j < h->mode_count; j++) {
            if (h->modes[j].wlr_mode == h->current_mode) {
                h->current_mode_index = j;
                break;
            }
        }
    }

    // Tear down. Use stop on v4+ (compositor will reply with finished); for
    // older versions destroy directly. Either way we're done with the data.
    if (state->manager) {
        if (state->manager_version >= 4) {
            zwlr_output_manager_v1_stop(state->manager);
        }
        zwlr_output_manager_v1_destroy(state->manager);
        state->manager = NULL;
    }

    wl_registry_destroy(registry);
    wl_display_roundtrip(display); // flush any pending requests
    wl_display_disconnect(display);

    return state->failed ? -3 : 0;
}
*/
import "C"

import (
	"context"
	"fmt"
	"os"
)

// waylandWlrProvider queries monitor information through the
// wlr-output-management-unstable-v1 protocol. This protocol is implemented by
// wlroots-based compositors (Hyprland, Sway, Wayfire, river) and KDE Plasma 6.
// It exposes everything wlr-randr reports: logical position, fractional scale,
// EDID make/model/serial, physical size, adaptive sync, enabled state.
//
// GNOME/Mutter does NOT implement this protocol; on those sessions Detect
// returns ErrProviderNotApplicable so the manager falls through to
// NewWaylandLegacyProvider.
type waylandWlrProvider struct{}

// waylandWlrProviderPriority ranks above the wayland-utauri HTTP monitor probe so
// zwlr_output_management is tried first on compositors that implement it.
const waylandWlrProviderPriority = 40

// NewWaylandProvider returns the preferred Wayland MonitorProvider, backed by
// the wlr-output-management-unstable-v1 protocol.
func NewWaylandProvider() MonitorProvider {
	return &waylandWlrProvider{}
}

func (p *waylandWlrProvider) Name() string               { return "wayland-wlr-output" }
func (p *waylandWlrProvider) Compositor() CompositorType { return CompositorWayland }
func (p *waylandWlrProvider) Priority() int              { return waylandWlrProviderPriority }

func (p *waylandWlrProvider) Detect(ctx context.Context) ([]Monitor, error) {
	if os.Getenv("WAYLAND_DISPLAY") == "" {
		return nil, fmt.Errorf("%w: WAYLAND_DISPLAY not set", ErrProviderNotApplicable)
	}

	snap, err := collectWlrSnapshot()
	if err != nil {
		return nil, err
	}
	return interpretWlrSnapshot(snap), nil
}

// collectWlrSnapshot drives the wayland event loop via cgo and returns a
// Go-native snapshot. This is the only function in the package that touches
// cgo state for the wlr provider; everything beyond it is pure Go.
//
// Returns ErrProviderNotApplicable when the compositor doesn't advertise
// zwlr_output_manager_v1, and ordinary errors for any other failure.
func collectWlrSnapshot() (wlrSnapshot, error) {
	var state C.CWlrState
	res := C.collect_monitors_wlr(&state)
	switch res {
	case 0:
		// fall through to copy
	case -1:
		return wlrSnapshot{}, fmt.Errorf("wlr-output: failed to connect to wayland display")
	case -2:
		return wlrSnapshot{}, fmt.Errorf("%w: compositor does not advertise zwlr_output_manager_v1", ErrProviderNotApplicable)
	case -3:
		return wlrSnapshot{}, fmt.Errorf("wlr-output: wayland dispatch failed before snapshot completed")
	default:
		return wlrSnapshot{}, fmt.Errorf("wlr-output: unknown error code %d", int(res))
	}
	return cWlrStateToGo(&state), nil
}

// cWlrStateToGo is a pure field-by-field copy from the C snapshot to its Go
// mirror. It performs no interpretation — all logic lives in
// interpretWlrSnapshot, which is unit-testable without cgo or a wayland
// compositor.
func cWlrStateToGo(state *C.CWlrState) wlrSnapshot {
	headCount := int(state.head_count)
	heads := make([]wlrHead, 0, headCount)
	for i := 0; i < headCount; i++ {
		ch := &state.heads[i]

		modeCount := int(ch.mode_count)
		modes := make([]wlrMode, 0, modeCount)
		for j := 0; j < modeCount; j++ {
			cm := &ch.modes[j]
			modes = append(modes, wlrMode{
				Width:      int(cm.width),
				Height:     int(cm.height),
				RefreshMHz: int(cm.refresh),
			})
		}

		heads = append(heads, wlrHead{
			Name:             C.GoString(&ch.name[0]),
			Description:      C.GoString(&ch.description[0]),
			Make:             C.GoString(&ch.make[0]),
			Model:            C.GoString(&ch.model[0]),
			Serial:           C.GoString(&ch.serial[0]),
			PhysicalWidth:    int(ch.phys_width),
			PhysicalHeight:   int(ch.phys_height),
			Enabled:          ch.enabled != 0,
			Finished:         ch.finished != 0,
			X:                int(ch.x),
			Y:                int(ch.y),
			Transform:        int(ch.transform),
			Scale:            float64(ch.scale),
			AdaptiveSync:     ch.adaptive_sync != 0,
			Modes:            modes,
			CurrentModeIndex: int(ch.current_mode_index),
		})
	}
	return wlrSnapshot{Heads: heads}
}
