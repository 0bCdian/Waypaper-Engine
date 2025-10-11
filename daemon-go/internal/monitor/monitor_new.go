package monitor

/*
#cgo pkg-config: wayland-client
#include <wayland-client.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

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
} output_info;

typedef struct {
    output_info *outputs;
    int count;
    int capacity;
} outputs_data;

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
}

static void output_mode(void *data, struct wl_output *wl_output,
                       uint32_t flags, int32_t width, int32_t height,
                       int32_t refresh) {
    if (flags & WL_OUTPUT_MODE_CURRENT) {
        output_info *info = (output_info *)data;
        info->width = width;
        info->height = height;
        info->refresh = refresh;
    }
}

static void output_done(void *data, struct wl_output *wl_output) {}

static void output_scale(void *data, struct wl_output *wl_output, int32_t factor) {
    output_info *info = (output_info *)data;
    info->scale = factor;
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
    outputs_data *outputs = (outputs_data *)data;
    if (strcmp(interface, "wl_output") == 0 && outputs->count < outputs->capacity) {
        struct wl_output *output = wl_registry_bind(registry, name, &wl_output_interface, 2);
        output_info *info = &outputs->outputs[outputs->count];
        memset(info, 0, sizeof(output_info));
        info->scale = 1;
        wl_output_add_listener(output, &output_listener, info);
        outputs->count++;
    }
}

static void registry_global_remove(void *data, struct wl_registry *registry, uint32_t name) {}

static const struct wl_registry_listener registry_listener = {
    .global = registry_global,
    .global_remove = registry_global_remove,
};

outputs_data* query_wayland_outputs() {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return NULL;

    struct wl_registry *registry = wl_display_get_registry(display);
    if (!registry) {
        wl_display_disconnect(display);
        return NULL;
    }

    outputs_data *outputs = malloc(sizeof(outputs_data));
    outputs->capacity = 16;
    outputs->count = 0;
    outputs->outputs = calloc(outputs->capacity, sizeof(output_info));

    wl_registry_add_listener(registry, &registry_listener, outputs);
    wl_display_roundtrip(display);
    wl_display_roundtrip(display);

    wl_registry_destroy(registry);
    wl_display_disconnect(display);

    return outputs;
}

void free_outputs_data(outputs_data *data) {
    if (data) {
        if (data->outputs) free(data->outputs);
        free(data);
    }
}
*/
import "C"

import (
	"fmt"
	"log"
	"time"
	"unsafe"
)

// MonitorInfo represents information about a single monitor
type MonitorInfo struct {
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

// MonitorManager handles monitor detection and event notification
type MonitorManager struct {
	events   chan MonitorEvent
	done     chan struct{}
	monitors map[string]MonitorInfo
	pollRate time.Duration
}

// NewMonitorManager creates a new monitor manager
func NewMonitorManager() (*MonitorManager, error) {
	mm := &MonitorManager{
		events:   make(chan MonitorEvent, 10),
		done:     make(chan struct{}),
		monitors: make(map[string]MonitorInfo),
		pollRate: 2 * time.Second,
	}

	// Initial scan
	monitors, err := queryWaylandMonitors()
	if err != nil {
		return nil, fmt.Errorf("failed initial monitor scan: %w", err)
	}

	for _, m := range monitors {
		mm.monitors[m.Name] = m
	}

	return mm, nil
}

// Events returns the event channel (read-only)
func (mm *MonitorManager) Events() <-chan MonitorEvent {
	return mm.events
}

// GetMonitors returns a snapshot of current monitors
func (mm *MonitorManager) GetMonitors() []MonitorInfo {
	monitors := make([]MonitorInfo, 0, len(mm.monitors))
	for _, m := range mm.monitors {
		monitors = append(monitors, m)
	}
	return monitors
}

// GetMonitorByName returns a monitor by its name
func (mm *MonitorManager) GetMonitorByName(name string) (MonitorInfo, bool) {
	m, exists := mm.monitors[name]
	return m, exists
}

// Start begins monitoring for monitor changes
func (mm *MonitorManager) Start() {
	go mm.watchLoop()
}

// Stop stops the monitor manager
func (mm *MonitorManager) Stop() {
	select {
	case <-mm.done:
		// Already closed
	default:
		close(mm.done)
	}

	select {
	case <-mm.events:
		// Already closed
	default:
		close(mm.events)
	}
}

// SetPollRate changes how often we check for monitor changes
func (mm *MonitorManager) SetPollRate(rate time.Duration) {
	mm.pollRate = rate
}

// Internal watch loop that polls for changes
func (mm *MonitorManager) watchLoop() {
	ticker := time.NewTicker(mm.pollRate)
	defer ticker.Stop()

	for {
		select {
		case <-mm.done:
			return
		case <-ticker.C:
			mm.checkForChanges()
		}
	}
}

// Check for monitor configuration changes
func (mm *MonitorManager) checkForChanges() {
	current, err := queryWaylandMonitors()
	if err != nil {
		log.Printf("Error querying monitors: %v", err)
		return
	}

	currentMap := make(map[string]MonitorInfo)
	for _, m := range current {
		currentMap[m.Name] = m

		// Check if it's new or changed
		if old, exists := mm.monitors[m.Name]; !exists {
			mm.events <- MonitorEvent{
				Type:    MonitorAdded,
				Monitor: m,
			}
		} else if !monitorsEqual(old, m) {
			mm.events <- MonitorEvent{
				Type:    MonitorChanged,
				Monitor: m,
			}
		}
	}

	// Check for removed monitors
	for name, m := range mm.monitors {
		if _, exists := currentMap[name]; !exists {
			mm.events <- MonitorEvent{
				Type:    MonitorRemoved,
				Monitor: m,
			}
		}
	}

	mm.monitors = currentMap
}

// Compare two monitors for equality
func monitorsEqual(a, b MonitorInfo) bool {
	return a.X == b.X &&
		a.Y == b.Y &&
		a.Width == b.Width &&
		a.Height == b.Height &&
		a.Scale == b.Scale &&
		a.Transform == b.Transform
}

// Query Wayland for current monitors (internal function)
func queryWaylandMonitors() ([]MonitorInfo, error) {
	cOutputs := C.query_wayland_outputs()
	if cOutputs == nil {
		return nil, fmt.Errorf("failed to connect to Wayland display")
	}
	defer C.free_outputs_data(cOutputs)

	count := int(cOutputs.count)
	if count == 0 {
		return nil, fmt.Errorf("no monitors detected")
	}

	monitors := make([]MonitorInfo, count)
	outputsSlice := unsafe.Slice(cOutputs.outputs, count)

	for i := range count {
		info := outputsSlice[i]
		make := C.GoString(&info.make[0])
		model := C.GoString(&info.model[0])

		monitors[i] = MonitorInfo{
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

	return monitors, nil
}

// Helper functions for your daemon

// GetPrimaryMonitor returns the monitor at position (0,0)
func GetPrimaryMonitor(monitors []MonitorInfo) *MonitorInfo {
	for i := range monitors {
		if monitors[i].X == 0 && monitors[i].Y == 0 {
			return &monitors[i]
		}
	}
	if len(monitors) > 0 {
		return &monitors[0]
	}
	return nil
}

// CalculateTotalBounds calculates the bounding box of all monitors
func CalculateTotalBounds(monitors []MonitorInfo) (x, y, width, height int32) {
	if len(monitors) == 0 {
		return 0, 0, 0, 0
	}

	minX := monitors[0].X
	minY := monitors[0].Y
	maxX := monitors[0].X + monitors[0].Width
	maxY := monitors[0].Y + monitors[0].Height

	for _, m := range monitors[1:] {
		if m.X < minX {
			minX = m.X
		}
		if m.Y < minY {
			minY = m.Y
		}
		if m.X+m.Width > maxX {
			maxX = m.X + m.Width
		}
		if m.Y+m.Height > maxY {
			maxY = m.Y + m.Height
		}
	}

	return minX, minY, maxX - minX, maxY - minY
}

// Example daemon usage
// func main() {
// 	log.Println("Starting Monitor Manager...")

// 	// Create monitor manager
// 	mm, err := NewMonitorManager()
// 	if err != nil {
// 		log.Fatalf("Failed to create monitor manager: %v", err)
// 	}
// 	defer mm.Stop()

// 	// Start watching for changes
// 	mm.Start()

// 	// Print initial monitors
// 	log.Println("\nInitial monitors:")
// 	for i, monitor := range mm.GetMonitors() {
// 		log.Printf("  [%d] %s: %dx%d at (%d,%d) scale=%d\n",
// 			i+1, monitor.Name, monitor.Width, monitor.Height,
// 			monitor.X, monitor.Y, monitor.Scale)
// 	}

// 	// Simulate daemon behavior - handle events
// 	log.Println("\nWatching for monitor changes... (try plugging in a monitor)")
// 	for event := range mm.Events() {
// 		switch event.Type {
// 		case MonitorAdded:
// 			log.Printf("🔵 Monitor ADDED: %s (%dx%d)\n",
// 				event.Monitor.Name, event.Monitor.Width, event.Monitor.Height)
// 			// In your daemon: spawnRenderer(event.Monitor)

// 		case MonitorRemoved:
// 			log.Printf("🔴 Monitor REMOVED: %s\n", event.Monitor.Name)
// 			// In your daemon: killRenderer(event.Monitor)

// 		case MonitorChanged:
// 			log.Printf("🟡 Monitor CHANGED: %s (now %dx%d at %d,%d)\n",
// 				event.Monitor.Name, event.Monitor.Width, event.Monitor.Height,
// 				event.Monitor.X, event.Monitor.Y)
// 			// In your daemon: updateRenderer(event.Monitor)
// 		}

// 		// Print current layout after each change
// 		x, y, w, h := CalculateTotalBounds(mm.GetMonitors())
// 		log.Printf("   Desktop: %dx%d at (%d,%d)\n", w, h, x, y)
// 	}
// }
