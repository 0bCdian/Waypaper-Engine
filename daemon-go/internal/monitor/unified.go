package monitor

/*
#cgo LDFLAGS: -lwayland-client -lX11 -lXrandr
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>

// Common structures
typedef struct {
    char name[256];
    char make[128];
    char model[128];
    int32_t x;
    int32_t y;
    int32_t width;
    int32_t height;
    int32_t physical_width;
    int32_t physical_height;
    double refresh_rate;
    int32_t scale;
    int32_t transform;
    int32_t primary;
} monitor_info;

// Forward declarations
extern void go_monitor_event_callback(void *context, int event_type, uint64_t id, monitor_info *info);

// ============================================================================
// WAYLAND IMPLEMENTATION
// ============================================================================
#ifdef __linux__
#include <wayland-client.h>

typedef struct {
    int32_t x;
    int32_t y;
    int32_t physical_width;
    int32_t physical_height;
    int32_t width;
    int32_t height;
    int32_t refresh;
    int32_t scale;
    int32_t transform;
    char make[128];
    char model[128];
    char connector_name[64];
    int dirty;
} wl_output_info;

typedef struct wl_output_state {
    uint32_t wl_name;
    struct wl_output *output;
    wl_output_info info;
    struct wl_output_state *next;
} wl_output_state;

typedef struct {
    struct wl_display *display;
    struct wl_registry *registry;
    wl_output_state *outputs;
    pthread_mutex_t lock;
    void *go_callback_context;
} wl_context;

static void wl_output_geometry(void *data, struct wl_output *wl_output,
                                int32_t x, int32_t y,
                                int32_t physical_width, int32_t physical_height,
                                int32_t subpixel, const char *make, const char *model,
                                int32_t transform) {
    wl_output_state *state = (wl_output_state *)data;
    wl_output_info *info = &state->info;
    info->x = x;
    info->y = y;
    info->physical_width = physical_width;
    info->physical_height = physical_height;
    info->transform = transform;
    strncpy(info->make, make ? make : "", sizeof(info->make) - 1);
    strncpy(info->model, model ? model : "", sizeof(info->model) - 1);
    info->dirty = 1;

    // Note: x,y from wl_output.geometry are typically 0,0
    // For actual compositor layout positions, use compositor-specific queries or protocol extensions
}

static void wl_output_mode(void *data, struct wl_output *wl_output,
                           uint32_t flags, int32_t width, int32_t height,
                           int32_t refresh) {
    if (flags & WL_OUTPUT_MODE_CURRENT) {
        wl_output_state *state = (wl_output_state *)data;
        wl_output_info *info = &state->info;
        info->width = width;
        info->height = height;
        info->refresh = refresh;
        info->dirty = 1;
    }
}

static void wl_output_done(void *data, struct wl_output *wl_output) {
    wl_output_state *state = (wl_output_state *)data;
    if (state->info.dirty) {
        wl_context *ctx = (wl_context *)wl_output_get_user_data(wl_output);
        if (ctx && ctx->go_callback_context) {
            monitor_info info;
            // Use connector_name if available, otherwise fall back to make/model
            if (state->info.connector_name[0] != '\0') {
                strncpy(info.name, state->info.connector_name, sizeof(info.name));
            } else {
                snprintf(info.name, sizeof(info.name), "%s %s", state->info.make, state->info.model);
            }
            strncpy(info.make, state->info.make, sizeof(info.make));
            strncpy(info.model, state->info.model, sizeof(info.model));
            info.x = state->info.x;
            info.y = state->info.y;
            info.width = state->info.width;
            info.height = state->info.height;
            info.physical_width = state->info.physical_width;
            info.physical_height = state->info.physical_height;
            info.refresh_rate = (double)state->info.refresh / 1000.0;
            info.scale = state->info.scale;
            info.transform = state->info.transform;
            info.primary = (state->info.x == 0 && state->info.y == 0) ? 1 : 0;

            go_monitor_event_callback(ctx->go_callback_context, 2, state->wl_name, &info);
        }
        state->info.dirty = 0;
    }
}

static void wl_output_scale(void *data, struct wl_output *wl_output, int32_t factor) {
    wl_output_state *state = (wl_output_state *)data;
    wl_output_info *info = &state->info;
    info->scale = factor;
    info->dirty = 1;
}

static void wl_output_name(void *data, struct wl_output *wl_output, const char *name) {
    wl_output_state *state = (wl_output_state *)data;
    wl_output_info *info = &state->info;
    if (name) {
        strncpy(info->connector_name, name, sizeof(info->connector_name) - 1);
        info->dirty = 1;
    }
}

static void wl_output_description(void *data, struct wl_output *wl_output, const char *description) {}

static const struct wl_output_listener wl_output_listener = {
    .geometry = wl_output_geometry,
    .mode = wl_output_mode,
    .done = wl_output_done,
    .scale = wl_output_scale,
    .name = wl_output_name,
    .description = wl_output_description,
};

static void wl_registry_global(void *data, struct wl_registry *registry,
                               uint32_t name, const char *interface, uint32_t version) {
    wl_context *ctx = (wl_context *)data;

    if (strcmp(interface, "wl_output") == 0) {
        pthread_mutex_lock(&ctx->lock);

        struct wl_output *output = wl_registry_bind(registry, name, &wl_output_interface, 4);
        wl_output_set_user_data(output, ctx);

        wl_output_state *state = malloc(sizeof(wl_output_state));
        memset(state, 0, sizeof(wl_output_state));
        state->wl_name = name;
        state->output = output;
        state->info.scale = 1;
        state->info.dirty = 1;

        state->next = ctx->outputs;
        ctx->outputs = state;

        wl_output_add_listener(output, &wl_output_listener, state);

        pthread_mutex_unlock(&ctx->lock);
    }
}

static void wl_registry_global_remove(void *data, struct wl_registry *registry, uint32_t name) {
    wl_context *ctx = (wl_context *)data;

    pthread_mutex_lock(&ctx->lock);

    wl_output_state **current = &ctx->outputs;
    while (*current) {
        if ((*current)->wl_name == name) {
            wl_output_state *to_remove = *current;
            *current = to_remove->next;

            if (ctx->go_callback_context) {
                monitor_info info;
                // Use connector_name if available, otherwise fall back to make/model
                if (to_remove->info.connector_name[0] != '\0') {
                    strncpy(info.name, to_remove->info.connector_name, sizeof(info.name));
                } else {
                    snprintf(info.name, sizeof(info.name), "%s %s", to_remove->info.make, to_remove->info.model);
                }
                strncpy(info.make, to_remove->info.make, sizeof(info.make));
                strncpy(info.model, to_remove->info.model, sizeof(info.model));
                info.x = to_remove->info.x;
                info.y = to_remove->info.y;
                info.width = to_remove->info.width;
                info.height = to_remove->info.height;
                info.physical_width = to_remove->info.physical_width;
                info.physical_height = to_remove->info.physical_height;
                info.refresh_rate = (double)to_remove->info.refresh / 1000.0;
                info.scale = to_remove->info.scale;
                info.transform = to_remove->info.transform;
                info.primary = 0;

                go_monitor_event_callback(ctx->go_callback_context, 1, name, &info);
            }

            wl_output_destroy(to_remove->output);
            free(to_remove);
            break;
        }
        current = &(*current)->next;
    }

    pthread_mutex_unlock(&ctx->lock);
}

static const struct wl_registry_listener wl_registry_listener = {
    .global = wl_registry_global,
    .global_remove = wl_registry_global_remove,
};

static void* wayland_init(void *go_context) {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return NULL;

    wl_context *ctx = malloc(sizeof(wl_context));
    memset(ctx, 0, sizeof(wl_context));
    ctx->display = display;
    ctx->go_callback_context = go_context;
    pthread_mutex_init(&ctx->lock, NULL);

    ctx->registry = wl_display_get_registry(display);
    if (!ctx->registry) {
        wl_display_disconnect(display);
        free(ctx);
        return NULL;
    }

    wl_registry_add_listener(ctx->registry, &wl_registry_listener, ctx);
    wl_display_roundtrip(display);
    wl_display_roundtrip(display);

    return ctx;
}

static int wayland_dispatch(void *context) {
    wl_context *ctx = (wl_context *)context;
    if (!ctx || !ctx->display) return -1;
    return wl_display_dispatch(ctx->display);
}

static void wayland_cleanup(void *context) {
    wl_context *ctx = (wl_context *)context;
    if (!ctx) return;

    pthread_mutex_lock(&ctx->lock);

    wl_output_state *current = ctx->outputs;
    while (current) {
        wl_output_state *next = current->next;
        wl_output_destroy(current->output);
        free(current);
        current = next;
    }

    if (ctx->registry) wl_registry_destroy(ctx->registry);
    if (ctx->display) {
        wl_display_flush(ctx->display);
        wl_display_disconnect(ctx->display);
    }

    pthread_mutex_unlock(&ctx->lock);
    pthread_mutex_destroy(&ctx->lock);
    free(ctx);
}

static int wayland_get_outputs(void *context, monitor_info **outputs) {
    wl_context *ctx = (wl_context *)context;
    if (!ctx) return 0;

    pthread_mutex_lock(&ctx->lock);

    int count = 0;
    wl_output_state *current = ctx->outputs;
    while (current) {
        count++;
        current = current->next;
    }

    if (count == 0) {
        pthread_mutex_unlock(&ctx->lock);
        return 0;
    }

    *outputs = malloc(count * sizeof(monitor_info));
    current = ctx->outputs;
    int i = 0;
    while (current) {
        // Use connector_name if available, otherwise fall back to make/model
        if (current->info.connector_name[0] != '\0') {
            strncpy((*outputs)[i].name, current->info.connector_name, sizeof((*outputs)[i].name));
        } else {
            snprintf((*outputs)[i].name, sizeof((*outputs)[i].name), "%s %s", current->info.make, current->info.model);
        }
        strncpy((*outputs)[i].make, current->info.make, sizeof((*outputs)[i].make));
        strncpy((*outputs)[i].model, current->info.model, sizeof((*outputs)[i].model));
        (*outputs)[i].x = current->info.x;
        (*outputs)[i].y = current->info.y;
        (*outputs)[i].width = current->info.width;
        (*outputs)[i].height = current->info.height;
        (*outputs)[i].physical_width = current->info.physical_width;
        (*outputs)[i].physical_height = current->info.physical_height;
        (*outputs)[i].refresh_rate = (double)current->info.refresh / 1000.0;
        (*outputs)[i].scale = current->info.scale;
        (*outputs)[i].transform = current->info.transform;
        (*outputs)[i].primary = (current->info.x == 0 && current->info.y == 0) ? 1 : 0;
        i++;
        current = current->next;
    }

    pthread_mutex_unlock(&ctx->lock);
    return count;
}
#endif

// ============================================================================
// X11 IMPLEMENTATION
// ============================================================================
#include <X11/Xlib.h>
#include <X11/extensions/Xrandr.h>

typedef struct x11_output_state {
    RROutput output_id;
    monitor_info info;
    struct x11_output_state *next;
} x11_output_state;

typedef struct {
    Display *display;
    Window root;
    int screen;
    int xrandr_event_base;
    int xrandr_error_base;
    x11_output_state *outputs;
    void *go_callback_context;
} x11_context;

static monitor_info x11_get_output_info(Display *display, XRRScreenResources *resources, RROutput output_id, RROutput primary) {
    monitor_info result;
    memset(&result, 0, sizeof(monitor_info));

    XRROutputInfo *output_info = XRRGetOutputInfo(display, resources, output_id);
    if (!output_info || output_info->connection != RR_Connected) {
        if (output_info) XRRFreeOutputInfo(output_info);
        return result;
    }

    strncpy(result.name, output_info->name, sizeof(result.name) - 1);
    result.physical_width = output_info->mm_width;
    result.physical_height = output_info->mm_height;
    result.primary = (output_id == primary) ? 1 : 0;
    result.scale = 1;

    if (output_info->crtc) {
        XRRCrtcInfo *crtc_info = XRRGetCrtcInfo(display, resources, output_info->crtc);
        if (crtc_info) {
            result.x = crtc_info->x;
            result.y = crtc_info->y;
            result.width = crtc_info->width;
            result.height = crtc_info->height;

            if (crtc_info->mode != None) {
                for (int i = 0; i < resources->nmode; i++) {
                    if (resources->modes[i].id == crtc_info->mode) {
                        XRRModeInfo *mode = &resources->modes[i];
                        if (mode->hTotal && mode->vTotal) {
                            result.refresh_rate = (double)mode->dotClock /
                                                 ((double)mode->hTotal * (double)mode->vTotal);
                        }
                        break;
                    }
                }
            }

            XRRFreeCrtcInfo(crtc_info);
        }
    }

    XRRFreeOutputInfo(output_info);
    return result;
}

static void x11_scan_outputs(x11_context *ctx) {
    XRRScreenResources *resources = XRRGetScreenResources(ctx->display, ctx->root);
    if (!resources) return;

    RROutput primary = XRRGetOutputPrimary(ctx->display, ctx->root);

    x11_output_state *new_outputs = NULL;

    for (int i = 0; i < resources->noutput; i++) {
        RROutput output_id = resources->outputs[i];
        monitor_info info = x11_get_output_info(ctx->display, resources, output_id, primary);

        if (info.width == 0 || info.height == 0) continue;

        x11_output_state *state = malloc(sizeof(x11_output_state));
        state->output_id = output_id;
        state->info = info;
        state->next = new_outputs;
        new_outputs = state;

        x11_output_state *existing = ctx->outputs;
        int found = 0;
        while (existing) {
            if (existing->output_id == output_id) {
                found = 1;
                if (memcmp(&existing->info, &info, sizeof(monitor_info)) != 0) {
                    if (ctx->go_callback_context) {
                        go_monitor_event_callback(ctx->go_callback_context, 2, output_id, &info);
                    }
                }
                break;
            }
            existing = existing->next;
        }

        if (!found && ctx->go_callback_context) {
            go_monitor_event_callback(ctx->go_callback_context, 0, output_id, &info);
        }
    }

    x11_output_state *current = ctx->outputs;
    while (current) {
        int found = 0;
        x11_output_state *new_current = new_outputs;
        while (new_current) {
            if (new_current->output_id == current->output_id) {
                found = 1;
                break;
            }
            new_current = new_current->next;
        }

        if (!found && ctx->go_callback_context) {
            go_monitor_event_callback(ctx->go_callback_context, 1, current->output_id, &current->info);
        }

        current = current->next;
    }

    current = ctx->outputs;
    while (current) {
        x11_output_state *next = current->next;
        free(current);
        current = next;
    }

    ctx->outputs = new_outputs;
    XRRFreeScreenResources(resources);
}

static void* x11_init(void *go_context) {
    Display *display = XOpenDisplay(NULL);
    if (!display) return NULL;

    int event_base, error_base;
    if (!XRRQueryExtension(display, &event_base, &error_base)) {
        XCloseDisplay(display);
        return NULL;
    }

    x11_context *ctx = malloc(sizeof(x11_context));
    memset(ctx, 0, sizeof(x11_context));

    ctx->display = display;
    ctx->screen = DefaultScreen(display);
    ctx->root = RootWindow(display, ctx->screen);
    ctx->xrandr_event_base = event_base;
    ctx->xrandr_error_base = error_base;
    ctx->go_callback_context = go_context;

    XRRSelectInput(ctx->display, ctx->root,
                   RRScreenChangeNotifyMask |
                   RRCrtcChangeNotifyMask |
                   RROutputChangeNotifyMask |
                   RROutputPropertyNotifyMask);

    x11_scan_outputs(ctx);

    return ctx;
}

static int x11_get_fd(void *context) {
    x11_context *ctx = (x11_context *)context;
    if (!ctx || !ctx->display) return -1;
    return ConnectionNumber(ctx->display);
}

static int x11_pending(void *context) {
    x11_context *ctx = (x11_context *)context;
    if (!ctx || !ctx->display) return 0;
    return XPending(ctx->display);
}

static int x11_process_event(void *context) {
    x11_context *ctx = (x11_context *)context;
    if (!ctx || !ctx->display) return -1;

    XEvent event;
    XNextEvent(ctx->display, &event);

    if (event.type == ctx->xrandr_event_base + RRScreenChangeNotify ||
        event.type == ctx->xrandr_event_base + RRNotify) {
        XRRUpdateConfiguration(&event);
        x11_scan_outputs(ctx);
        return 1;
    }

    return 0;
}

static void x11_cleanup(void *context) {
    x11_context *ctx = (x11_context *)context;
    if (!ctx) return;

    x11_output_state *current = ctx->outputs;
    while (current) {
        x11_output_state *next = current->next;
        free(current);
        current = next;
    }

    if (ctx->display) {
        XCloseDisplay(ctx->display);
    }

    free(ctx);
}

static int x11_get_outputs(void *context, monitor_info **outputs) {
    x11_context *ctx = (x11_context *)context;
    if (!ctx) return 0;

    int count = 0;
    x11_output_state *current = ctx->outputs;
    while (current) {
        count++;
        current = current->next;
    }

    if (count == 0) return 0;

    *outputs = malloc(count * sizeof(monitor_info));
    current = ctx->outputs;
    int i = 0;
    while (current) {
        (*outputs)[i] = current->info;
        i++;
        current = current->next;
    }

    return count;
}
*/
import "C"

import (
	"fmt"
	"os"
	"runtime/cgo"
	"sync"
	"syscall"
	"unsafe"
)

// DisplayProtocol represents the display server protocol
type DisplayProtocol int

const (
	ProtocolWayland DisplayProtocol = iota
	ProtocolX11
)

func (p DisplayProtocol) String() string {
	switch p {
	case ProtocolWayland:
		return "Wayland"
	case ProtocolX11:
		return "X11"
	default:
		return "Unknown"
	}
}

// MonitorInfo represents information about a single monitor
type MonitorInfo struct {
	Name           string
	Make           string
	Model          string
	X              int32
	Y              int32
	Width          int32
	Height         int32
	PhysicalWidth  int32
	PhysicalHeight int32
	RefreshRate    float64
	Scale          int32
	Transform      int32
	Primary        bool
}

// MonitorEventType represents the type of monitor event
type MonitorEventType int

const (
	MonitorAdded MonitorEventType = iota
	MonitorRemoved
	MonitorChanged
)

func (t MonitorEventType) String() string {
	switch t {
	case MonitorAdded:
		return "Added"
	case MonitorRemoved:
		return "Removed"
	case MonitorChanged:
		return "Changed"
	default:
		return "Unknown"
	}
}

// MonitorEvent represents a change in monitor configuration
type MonitorEvent struct {
	Type    MonitorEventType
	Monitor MonitorInfo
}

// UnifiedMonitorManager handles monitor detection and event notification
type UnifiedMonitorManager struct {
	protocol DisplayProtocol
	ctx      unsafe.Pointer
	handle   cgo.Handle
	events   chan MonitorEvent
	done     chan struct{}
	wg       sync.WaitGroup
	mu       sync.Mutex
	monitors map[uint64]MonitorInfo
}

// DetectProtocol detects which display protocol is running
func DetectProtocol() DisplayProtocol {
	// Check for Wayland first
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return ProtocolWayland
	}
	// Check for X11
	if os.Getenv("DISPLAY") != "" {
		return ProtocolX11
	}
	// Default to X11 if nothing is set
	return ProtocolX11
}

// NewUnifiedMonitorManager creates a new monitor manager using the detected protocol
func NewUnifiedMonitorManager() (*UnifiedMonitorManager, error) {
	return NewUnifiedMonitorManagerWithProtocol(DetectProtocol())
}

// NewUnifiedMonitorManagerWithProtocol creates a monitor manager with explicit protocol
func NewUnifiedMonitorManagerWithProtocol(protocol DisplayProtocol) (*UnifiedMonitorManager, error) {
	mm := &UnifiedMonitorManager{
		protocol: protocol,
		events:   make(chan MonitorEvent, 10),
		done:     make(chan struct{}),
		monitors: make(map[uint64]MonitorInfo),
	}

	mm.handle = cgo.NewHandle(mm)

	switch protocol {
	case ProtocolWayland:
		mm.ctx = C.wayland_init(unsafe.Pointer(uintptr(mm.handle)))
		if mm.ctx == nil {
			mm.handle.Delete()
			return nil, fmt.Errorf("failed to connect to Wayland display")
		}

	case ProtocolX11:
		mm.ctx = C.x11_init(unsafe.Pointer(uintptr(mm.handle)))
		if mm.ctx == nil {
			mm.handle.Delete()
			return nil, fmt.Errorf("failed to connect to X11 display or RandR not available")
		}
	}

	// Get initial monitors
	if err := mm.updateMonitorSnapshot(); err != nil {
		mm.cleanup()
		mm.handle.Delete()
		return nil, err
	}

	return mm, nil
}

// Protocol returns the display protocol being used
func (mm *UnifiedMonitorManager) Protocol() DisplayProtocol {
	return mm.protocol
}

// Events returns the event channel (read-only)
func (mm *UnifiedMonitorManager) Events() <-chan MonitorEvent {
	return mm.events
}

// GetMonitors returns a snapshot of current monitors as a map
func (mm *UnifiedMonitorManager) GetMonitors() Monitors {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitors := make(Monitors)
	for _, m := range mm.monitors {
		monitors[m.Name] = Monitor{
			Name:         m.Name,
			Width:        int(m.Width),
			Height:       int(m.Height),
			CurrentImage: "",
			Position: Position{
				X: int(m.X),
				Y: int(m.Y),
			},
		}
	}
	return monitors
}

// GetMonitorByName returns a monitor by its name
func (mm *UnifiedMonitorManager) GetMonitorByName(name string) (Monitor, bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	for _, m := range mm.monitors {
		if m.Name == name {
			return Monitor{
				Name:         m.Name,
				Width:        int(m.Width),
				Height:       int(m.Height),
				CurrentImage: "",
				Position: Position{
					X: int(m.X),
					Y: int(m.Y),
				},
			}, true
		}
	}
	return Monitor{}, false
}

// GetPrimaryMonitor returns the primary monitor
func (mm *UnifiedMonitorManager) GetPrimaryMonitor() (Monitor, bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	// Find primary monitor
	for _, m := range mm.monitors {
		if m.Primary {
			return Monitor{
				Name:         m.Name,
				Width:        int(m.Width),
				Height:       int(m.Height),
				CurrentImage: "",
				Position: Position{
					X: int(m.X),
					Y: int(m.Y),
				},
			}, true
		}
	}

	// Fallback: return monitor at 0,0
	for _, m := range mm.monitors {
		if m.X == 0 && m.Y == 0 {
			return Monitor{
				Name:         m.Name,
				Width:        int(m.Width),
				Height:       int(m.Height),
				CurrentImage: "",
				Position: Position{
					X: int(m.X),
					Y: int(m.Y),
				},
			}, true
		}
	}

	// Return first monitor
	for _, m := range mm.monitors {
		return Monitor{
			Name:         m.Name,
			Width:        int(m.Width),
			Height:       int(m.Height),
			CurrentImage: "",
			Position: Position{
				X: int(m.X),
				Y: int(m.Y),
			},
		}, true
	}

	return Monitor{}, false
}

// GetCompositorInfo returns information about the current compositor
func (mm *UnifiedMonitorManager) GetCompositorInfo() *CompositorInfo {
	var compositorType CompositorType
	switch mm.protocol {
	case ProtocolWayland:
		compositorType = CompositorTypeWayland
	case ProtocolX11:
		compositorType = CompositorTypeX11
	default:
		compositorType = CompositorTypeAuto
	}

	return &CompositorInfo{
		Type: compositorType,
	}
}

// Start begins monitoring for monitor changes
func (mm *UnifiedMonitorManager) Start() error {
	mm.wg.Add(1)
	go mm.eventLoop()
	return nil
}

// Stop stops the monitor manager
func (mm *UnifiedMonitorManager) Stop() {
	close(mm.done)
	mm.wg.Wait()

	mm.cleanup()
	mm.handle.Delete()
	close(mm.events)
}

// cleanup handles protocol-specific cleanup
func (mm *UnifiedMonitorManager) cleanup() {
	if mm.ctx == nil {
		return
	}

	switch mm.protocol {
	case ProtocolWayland:
		C.wayland_cleanup(mm.ctx)
	case ProtocolX11:
		C.x11_cleanup(mm.ctx)
	}
	mm.ctx = nil
}

// eventLoop processes display server events
func (mm *UnifiedMonitorManager) eventLoop() {
	defer mm.wg.Done()

	switch mm.protocol {
	case ProtocolWayland:
		mm.waylandEventLoop()
	case ProtocolX11:
		mm.x11EventLoop()
	}
}

func (mm *UnifiedMonitorManager) waylandEventLoop() {
	for {
		select {
		case <-mm.done:
			return
		default:
			ret := C.wayland_dispatch(mm.ctx)
			if ret < 0 {
				return
			}
		}
	}
}

func (mm *UnifiedMonitorManager) x11EventLoop() {
	fd := int(C.x11_get_fd(mm.ctx))
	if fd < 0 {
		return
	}

	for {
		// Process any pending events first
		for C.x11_pending(mm.ctx) > 0 {
			C.x11_process_event(mm.ctx)
		}

		// Use select to wait for events
		fdSet := &syscall.FdSet{}
		fdSet.Bits[fd/64] |= 1 << (uint(fd) % 64)

		timeout := syscall.Timeval{Sec: 0, Usec: 100000} // 100ms

		select {
		case <-mm.done:
			return
		default:
			n, err := syscall.Select(fd+1, fdSet, nil, nil, &timeout)
			if err != nil && err != syscall.EINTR {
				return
			}
			if n > 0 {
				continue
			}
		}
	}
}

// updateMonitorSnapshot fetches current state
func (mm *UnifiedMonitorManager) updateMonitorSnapshot() error {
	var cOutputs *C.monitor_info
	var count C.int

	switch mm.protocol {
	case ProtocolWayland:
		count = C.int(C.wayland_get_outputs(mm.ctx, &cOutputs))
	case ProtocolX11:
		count = C.int(C.x11_get_outputs(mm.ctx, &cOutputs))
	}

	if count == 0 || cOutputs == nil {
		return nil
	}
	defer C.free(unsafe.Pointer(cOutputs))

	outputsSlice := unsafe.Slice(cOutputs, int(count))
	for i, info := range outputsSlice {
		monitor := cMonitorInfoToGo(&info)
		mm.monitors[uint64(i)] = monitor
	}

	return nil
}

// handleEvent is called from C when monitors change
func (mm *UnifiedMonitorManager) handleEvent(eventType int, id uint64, info *C.monitor_info) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitor := cMonitorInfoToGo(info)

	switch eventType {
	case 0: // Added
		mm.monitors[id] = monitor
		select {
		case mm.events <- MonitorEvent{Type: MonitorAdded, Monitor: monitor}:
		case <-mm.done:
		}

	case 1: // Removed
		if old, exists := mm.monitors[id]; exists {
			delete(mm.monitors, id)
			select {
			case mm.events <- MonitorEvent{Type: MonitorRemoved, Monitor: old}:
			case <-mm.done:
			}
		}

	case 2: // Changed
		old := mm.monitors[id]
		if !monitorsEqual(old, monitor) {
			mm.monitors[id] = monitor
			select {
			case mm.events <- MonitorEvent{Type: MonitorChanged, Monitor: monitor}:
			case <-mm.done:
			}
		}
	}
}

// Convert C monitor_info to Go MonitorInfo
func cMonitorInfoToGo(info *C.monitor_info) MonitorInfo {
	return MonitorInfo{
		Name:           C.GoString(&info.name[0]),
		Make:           C.GoString(&info.make[0]),
		Model:          C.GoString(&info.model[0]),
		X:              int32(info.x),
		Y:              int32(info.y),
		Width:          int32(info.width),
		Height:         int32(info.height),
		PhysicalWidth:  int32(info.physical_width),
		PhysicalHeight: int32(info.physical_height),
		RefreshRate:    float64(info.refresh_rate),
		Scale:          int32(info.scale),
		Transform:      int32(info.transform),
		Primary:        info.primary != 0,
	}
}

// Compare two monitors for equality
func monitorsEqual(a, b MonitorInfo) bool {
	return a.Name == b.Name &&
		a.X == b.X &&
		a.Y == b.Y &&
		a.Width == b.Width &&
		a.Height == b.Height &&
		a.Scale == b.Scale &&
		a.Transform == b.Transform &&
		a.Primary == b.Primary
}

//export go_monitor_event_callback
func go_monitor_event_callback(context unsafe.Pointer, eventType C.int, id C.uint64_t, info *C.monitor_info) {
	defer func() {
		if r := recover(); r != nil {
			// Silently ignore panics during initialization
			// The callbacks are triggered during wayland_init/x11_init before the Go runtime is fully ready
		}
	}()

	handle := cgo.Handle(context)
	mm := handle.Value().(*UnifiedMonitorManager)
	mm.handleEvent(int(eventType), uint64(id), info)
}
