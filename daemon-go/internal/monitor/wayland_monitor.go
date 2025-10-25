package monitor

/*
#cgo pkg-config: wayland-client
#include <wayland-client.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <pthread.h>

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
    int dirty;
} output_info;

typedef struct output_state {
    uint32_t wl_name;
    struct wl_output *output;
    output_info info;
    struct output_state *next;
} output_state;

typedef struct {
    struct wl_display *display;
    struct wl_registry *registry;
    output_state *outputs;
    pthread_mutex_t lock;
    void *go_callback_context;
} wayland_context;

extern void go_monitor_event_callback(void *context, int event_type, uint32_t wl_name, output_info *info);

static void output_geometry(void *data, struct wl_output *wl_output,
                           int32_t x, int32_t y,
                           int32_t physical_width, int32_t physical_height,
                           int32_t subpixel, const char *make, const char *model,
                           int32_t transform) {
    output_info *info = (output_info *)data;
    info->x = x;
    info->y = y;
    info->physical_width = physical_width;
    info->physical_height = physical_height;
    info->transform = transform;
    strncpy(info->make, make ? make : "", sizeof(info->make) - 1);
    strncpy(info->model, model ? model : "", sizeof(info->model) - 1);
    info->dirty = 1;
}

static void output_mode(void *data, struct wl_output *wl_output,
                       uint32_t flags, int32_t width, int32_t height,
                       int32_t refresh) {
    if (flags & WL_OUTPUT_MODE_CURRENT) {
        output_info *info = (output_info *)data;
        info->width = width;
        info->height = height;
        info->refresh = refresh;
        info->dirty = 1;
    }
}

static void output_done(void *data, struct wl_output *wl_output) {
    output_state *state = (output_state *)data;
    if (state->info.dirty) {
        wayland_context *ctx = (wayland_context *)wl_output_get_user_data(wl_output);
        if (ctx && ctx->go_callback_context) {
            go_monitor_event_callback(ctx->go_callback_context, 2, state->wl_name, &state->info);
        }
        state->info.dirty = 0;
    }
}

static void output_scale(void *data, struct wl_output *wl_output, int32_t factor) {
    output_info *info = (output_info *)data;
    info->scale = factor;
    info->dirty = 1;
}

static void output_name(void *data, struct wl_output *wl_output, const char *name) {}
static void output_description(void *data, struct wl_output *wl_output, const char *description) {}

static const struct wl_output_listener output_listener = {
    .geometry = output_geometry,
    .mode = output_mode,
    .done = output_done,
    .scale = output_scale,
    .name = output_name,
    .description = output_description,
};

static void registry_global(void *data, struct wl_registry *registry,
                           uint32_t name, const char *interface, uint32_t version) {
    wayland_context *ctx = (wayland_context *)data;

    if (strcmp(interface, "wl_output") == 0) {
        pthread_mutex_lock(&ctx->lock);

        struct wl_output *output = wl_registry_bind(registry, name, &wl_output_interface, 2);
        wl_output_set_user_data(output, ctx);

        output_state *state = malloc(sizeof(output_state));
        memset(state, 0, sizeof(output_state));
        state->wl_name = name;
        state->output = output;
        state->info.scale = 1;
        state->info.dirty = 1;

        state->next = ctx->outputs;
        ctx->outputs = state;

        wl_output_add_listener(output, &output_listener, state);

        pthread_mutex_unlock(&ctx->lock);
    }
}

static void registry_global_remove(void *data, struct wl_registry *registry, uint32_t name) {
    wayland_context *ctx = (wayland_context *)data;

    pthread_mutex_lock(&ctx->lock);

    output_state **current = &ctx->outputs;
    while (*current) {
        if ((*current)->wl_name == name) {
            output_state *to_remove = *current;
            *current = to_remove->next;

            if (ctx->go_callback_context) {
                go_monitor_event_callback(ctx->go_callback_context, 1, name, &to_remove->info);
            }

            wl_output_destroy(to_remove->output);
            free(to_remove);
            break;
        }
        current = &(*current)->next;
    }

    pthread_mutex_unlock(&ctx->lock);
}

static const struct wl_registry_listener registry_listener = {
    .global = registry_global,
    .global_remove = registry_global_remove,
};

wayland_context* wayland_init(void *go_context) {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return NULL;

    wayland_context *ctx = malloc(sizeof(wayland_context));
    memset(ctx, 0, sizeof(wayland_context));
    ctx->display = display;
    ctx->go_callback_context = go_context;
    pthread_mutex_init(&ctx->lock, NULL);

    ctx->registry = wl_display_get_registry(display);
    if (!ctx->registry) {
        wl_display_disconnect(display);
        free(ctx);
        return NULL;
    }

    wl_registry_add_listener(ctx->registry, &registry_listener, ctx);
    wl_display_roundtrip(display);
    wl_display_roundtrip(display);

    return ctx;
}

int wayland_dispatch(wayland_context *ctx) {
    if (!ctx || !ctx->display) return -1;
    return wl_display_dispatch(ctx->display);
}

void wayland_cleanup(wayland_context *ctx) {
    if (!ctx) return;

    pthread_mutex_lock(&ctx->lock);

    output_state *current = ctx->outputs;
    while (current) {
        output_state *next = current->next;
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

output_info* wayland_get_outputs(wayland_context *ctx, int *count) {
    if (!ctx) {
        *count = 0;
        return NULL;
    }

    pthread_mutex_lock(&ctx->lock);

    int n = 0;
    output_state *current = ctx->outputs;
    while (current) {
        n++;
        current = current->next;
    }

    output_info *outputs = malloc(n * sizeof(output_info));
    current = ctx->outputs;
    int i = 0;
    while (current) {
        outputs[i] = current->info;
        i++;
        current = current->next;
    }

    pthread_mutex_unlock(&ctx->lock);

    *count = n;
    return outputs;
}
*/
import "C"

import (
	"fmt"
	"runtime/cgo"
	"sync"
	"unsafe"
)

// WaylandMonitorInfo represents information about a single Wayland monitor
type WaylandMonitorInfo struct {
	Name           string
	Make           string
	Model          string
	X              int32
	Y              int32
	Width          int32
	Height         int32
	RefreshRate    float64
	Scale          int32
	Transform      int32
	PhysicalWidth  int32
	PhysicalHeight int32
}

// WaylandMonitorEventType represents the type of monitor event
type WaylandMonitorEventType int

const (
	WaylandMonitorAdded WaylandMonitorEventType = iota
	WaylandMonitorRemoved
	WaylandMonitorChanged
)

func (t WaylandMonitorEventType) String() string {
	switch t {
	case WaylandMonitorAdded:
		return "Added"
	case WaylandMonitorRemoved:
		return "Removed"
	case WaylandMonitorChanged:
		return "Changed"
	default:
		return "Unknown"
	}
}

// WaylandMonitorEvent represents a change in monitor configuration
type WaylandMonitorEvent struct {
	Type    WaylandMonitorEventType
	Monitor WaylandMonitorInfo
}

// WaylandMonitorManager handles Wayland monitor detection and event notification
type WaylandMonitorManager struct {
	ctx      *C.wayland_context
	handle   cgo.Handle
	events   chan WaylandMonitorEvent
	done     chan struct{}
	wg       sync.WaitGroup
	mu       sync.Mutex
	monitors map[uint32]WaylandMonitorInfo
}

// NewWaylandMonitorManager creates a new Wayland monitor manager
func NewWaylandMonitorManager() (*WaylandMonitorManager, error) {
	mm := &WaylandMonitorManager{
		events:   make(chan WaylandMonitorEvent, 10),
		done:     make(chan struct{}),
		monitors: make(map[uint32]WaylandMonitorInfo),
	}

	// Store handle so C can call back to Go
	mm.handle = cgo.NewHandle(mm)

	// Initialize Wayland connection
	mm.ctx = C.wayland_init(unsafe.Pointer(&mm.handle))
	if mm.ctx == nil {
		mm.handle.Delete()
		return nil, fmt.Errorf("failed to connect to Wayland display")
	}

	// Get initial monitors
	if err := mm.updateMonitorSnapshot(); err != nil {
		C.wayland_cleanup(mm.ctx)
		mm.handle.Delete()
		return nil, err
	}

	return mm, nil
}

// Events returns the event channel (read-only)
func (mm *WaylandMonitorManager) Events() <-chan MonitorEvent {
	waylandEvents := mm.events
	events := make(chan MonitorEvent, 10)

	go func() {
		for event := range waylandEvents {
			events <- MonitorEvent{
				Type:    event.Type.String(),
				Monitor: convertWaylandMonitorToUnified(event.Monitor),
			}
		}
		close(events)
	}()

	return events
}

// GetMonitors returns a snapshot of current monitors as a map
func (mm *WaylandMonitorManager) GetMonitors() Monitors {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitors := make(Monitors)
	for _, m := range mm.monitors {
		converted := convertWaylandMonitorToUnified(m)
		monitors[converted.Name] = converted
	}
	return monitors
}

// GetMonitorByName returns a monitor by its name
func (mm *WaylandMonitorManager) GetMonitorByName(name string) (Monitor, bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	for _, m := range mm.monitors {
		if m.Name == name {
			return convertWaylandMonitorToUnified(m), true
		}
	}
	return Monitor{}, false
}

// GetPrimaryMonitor returns the primary monitor
func (mm *WaylandMonitorManager) GetPrimaryMonitor() (Monitor, bool) {
	monitors := mm.GetMonitors()
	if len(monitors) == 0 {
		return Monitor{}, false
	}

	// Find monitor at position (0,0)
	for _, m := range monitors {
		if m.Position.X == 0 && m.Position.Y == 0 {
			return m, true
		}
	}

	// Return first monitor if no primary found
	for _, m := range monitors {
		return m, true
	}

	return Monitor{}, false
}

// GetCompositorInfo returns information about the current compositor
func (mm *WaylandMonitorManager) GetCompositorInfo() *CompositorInfo {
	return &CompositorInfo{
		Type: CompositorTypeWayland,
	}
}

// Start begins monitoring for monitor changes
func (mm *WaylandMonitorManager) Start() error {
	mm.wg.Add(1)
	go mm.eventLoop()
	return nil
}

// Stop stops the monitor manager
func (mm *WaylandMonitorManager) Stop() {
	close(mm.done)
	mm.wg.Wait()

	if mm.ctx != nil {
		C.wayland_cleanup(mm.ctx)
		mm.ctx = nil
	}

	mm.handle.Delete()
	close(mm.events)
}

// eventLoop processes Wayland events
func (mm *WaylandMonitorManager) eventLoop() {
	defer mm.wg.Done()

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

// updateMonitorSnapshot fetches current state
func (mm *WaylandMonitorManager) updateMonitorSnapshot() error {
	var count C.int
	cOutputs := C.wayland_get_outputs(mm.ctx, &count)
	if cOutputs == nil && count == 0 {
		return nil
	}
	defer C.free(unsafe.Pointer(cOutputs))

	outputsSlice := unsafe.Slice(cOutputs, int(count))
	for i, info := range outputsSlice {
		monitor := cOutputInfoToGo(&info)
		mm.monitors[uint32(i)] = monitor
	}

	return nil
}

// handleEvent is called from C when monitors change
func (mm *WaylandMonitorManager) handleEvent(eventType int, wlName uint32, info *C.output_info) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitor := cOutputInfoToGo(info)

	switch eventType {
	case 0: // Added (initial discovery)
		mm.monitors[wlName] = monitor
		select {
		case mm.events <- WaylandMonitorEvent{Type: WaylandMonitorAdded, Monitor: monitor}:
		case <-mm.done:
		}

	case 1: // Removed
		if old, exists := mm.monitors[wlName]; exists {
			delete(mm.monitors, wlName)
			select {
			case mm.events <- WaylandMonitorEvent{Type: WaylandMonitorRemoved, Monitor: old}:
			case <-mm.done:
			}
		}

	case 2: // Changed
		old := mm.monitors[wlName]
		if !monitorsEqual(old, monitor) {
			mm.monitors[wlName] = monitor
			select {
			case mm.events <- WaylandMonitorEvent{Type: WaylandMonitorChanged, Monitor: monitor}:
			case <-mm.done:
			}
		}
	}
}

// Convert C output_info to Go WaylandMonitorInfo
func cOutputInfoToGo(info *C.output_info) WaylandMonitorInfo {
	make := C.GoString(&info.make[0])
	model := C.GoString(&info.model[0])

	return WaylandMonitorInfo{
		Name:           fmt.Sprintf("%s %s", make, model),
		Make:           make,
		Model:          model,
		X:              int32(info.x),
		Y:              int32(info.y),
		Width:          int32(info.width),
		Height:         int32(info.height),
		RefreshRate:    float64(info.refresh) / 1000.0,
		Scale:          int32(info.scale),
		Transform:      int32(info.transform),
		PhysicalWidth:  int32(info.physical_width),
		PhysicalHeight: int32(info.physical_height),
	}
}

// Compare two Wayland monitors for equality
func monitorsEqual(a, b WaylandMonitorInfo) bool {
	return a.X == b.X &&
		a.Y == b.Y &&
		a.Width == b.Width &&
		a.Height == b.Height &&
		a.Scale == b.Scale &&
		a.Transform == b.Transform
}

//export go_monitor_event_callback
func go_monitor_event_callback(context unsafe.Pointer, eventType C.int, wlName C.uint32_t, info *C.output_info) {
	handle := *(*cgo.Handle)(context)
	mm := handle.Value().(*WaylandMonitorManager)
	mm.handleEvent(int(eventType), uint32(wlName), info)
}

// convertWaylandMonitorToUnified converts WaylandMonitorInfo to Monitor
func convertWaylandMonitorToUnified(info WaylandMonitorInfo) Monitor {
	return Monitor{
		Name:         info.Name,
		Width:        int(info.Width),
		Height:       int(info.Height),
		CurrentImage: "", // Will be set by the manager
		Position: Position{
			X: int(info.X),
			Y: int(info.Y),
		},
	}
}
