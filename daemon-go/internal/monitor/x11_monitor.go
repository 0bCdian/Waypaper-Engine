package monitor

/*
#cgo pkg-config: x11 xrandr
#include <X11/Xlib.h>
#include <X11/extensions/Xrandr.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[256];
    int32_t x;
    int32_t y;
    int32_t width;
    int32_t height;
    int32_t physical_width;
    int32_t physical_height;
    double refresh_rate;
    int32_t primary;
} x11_output_info;

typedef struct x11_output_state {
    RROutput output_id;
    x11_output_info info;
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

extern void go_x11_monitor_event_callback(void *context, int event_type, RROutput output_id, x11_output_info *info);

static x11_output_info get_output_info(Display *display, XRRScreenResources *resources, RROutput output_id) {
    x11_output_info result;
    memset(&result, 0, sizeof(x11_output_info));

    XRROutputInfo *output_info = XRRGetOutputInfo(display, resources, output_id);
    if (!output_info || output_info->connection != RR_Connected) {
        if (output_info) XRRFreeOutputInfo(output_info);
        return result;
    }

    strncpy(result.name, output_info->name, sizeof(result.name) - 1);
    result.physical_width = output_info->mm_width;
    result.physical_height = output_info->mm_height;

    if (output_info->crtc) {
        XRRCrtcInfo *crtc_info = XRRGetCrtcInfo(display, resources, output_info->crtc);
        if (crtc_info) {
            result.x = crtc_info->x;
            result.y = crtc_info->y;
            result.width = crtc_info->width;
            result.height = crtc_info->height;

            // Get refresh rate from current mode
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

static void scan_outputs(x11_context *ctx) {
    XRRScreenResources *resources = XRRGetScreenResources(ctx->display, ctx->root);
    if (!resources) return;

    RROutput primary = XRRGetOutputPrimary(ctx->display, ctx->root);

    // Build map of current outputs
    x11_output_state *new_outputs = NULL;

    for (int i = 0; i < resources->noutput; i++) {
        RROutput output_id = resources->outputs[i];
        x11_output_info info = get_output_info(ctx->display, resources, output_id);

        // Skip disconnected outputs
        if (info.width == 0 || info.height == 0) continue;

        info.primary = (output_id == primary) ? 1 : 0;

        x11_output_state *state = malloc(sizeof(x11_output_state));
        state->output_id = output_id;
        state->info = info;
        state->next = new_outputs;
        new_outputs = state;

        // Check if this is a new output or changed
        x11_output_state *existing = ctx->outputs;
        int found = 0;
        while (existing) {
            if (existing->output_id == output_id) {
                found = 1;
                // Check if changed
                if (memcmp(&existing->info, &info, sizeof(x11_output_info)) != 0) {
                    if (ctx->go_callback_context) {
                        go_x11_monitor_event_callback(ctx->go_callback_context, 2, output_id, &info);
                    }
                }
                break;
            }
            existing = existing->next;
        }

        if (!found && ctx->go_callback_context) {
            go_x11_monitor_event_callback(ctx->go_callback_context, 0, output_id, &info);
        }
    }

    // Check for removed outputs
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
            go_x11_monitor_event_callback(ctx->go_callback_context, 1, current->output_id, &current->info);
        }

        current = current->next;
    }

    // Free old list
    current = ctx->outputs;
    while (current) {
        x11_output_state *next = current->next;
        free(current);
        current = next;
    }

    ctx->outputs = new_outputs;
    XRRFreeScreenResources(resources);
}

x11_context* x11_init(void *go_context) {
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

    // Select for RandR events
    XRRSelectInput(ctx->display, ctx->root,
                   RRScreenChangeNotifyMask |
                   RRCrtcChangeNotifyMask |
                   RROutputChangeNotifyMask |
                   RROutputPropertyNotifyMask);

    // Initial scan
    scan_outputs(ctx);

    return ctx;
}

int x11_get_fd(x11_context *ctx) {
    if (!ctx || !ctx->display) return -1;
    return ConnectionNumber(ctx->display);
}

int x11_pending(x11_context *ctx) {
    if (!ctx || !ctx->display) return 0;
    return XPending(ctx->display);
}

int x11_process_event(x11_context *ctx) {
    if (!ctx || !ctx->display) return -1;

    XEvent event;
    XNextEvent(ctx->display, &event);

    // Check if it's an RandR event
    if (event.type == ctx->xrandr_event_base + RRScreenChangeNotify ||
        event.type == ctx->xrandr_event_base + RRNotify) {

        XRRUpdateConfiguration(&event);
        scan_outputs(ctx);
        return 1;
    }

    return 0;
}

void x11_cleanup(x11_context *ctx) {
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

x11_output_info* x11_get_outputs(x11_context *ctx, int *count) {
    if (!ctx) {
        *count = 0;
        return NULL;
    }

    int n = 0;
    x11_output_state *current = ctx->outputs;
    while (current) {
        n++;
        current = current->next;
    }

    if (n == 0) {
        *count = 0;
        return NULL;
    }

    x11_output_info *outputs = malloc(n * sizeof(x11_output_info));
    current = ctx->outputs;
    int i = 0;
    while (current) {
        outputs[i] = current->info;
        i++;
        current = current->next;
    }

    *count = n;
    return outputs;
}
*/
import "C"

import (
	"fmt"
	"runtime/cgo"
	"sync"
	"syscall"
	"unsafe"

	"waypaper-engine/daemon-go/internal/types"
)

// X11MonitorInfo represents information about a single X11 monitor
type X11MonitorInfo struct {
	Name           string
	X              int32
	Y              int32
	Width          int32
	Height         int32
	PhysicalWidth  int32
	PhysicalHeight int32
	RefreshRate    float64
	Primary        bool
}

// X11MonitorEventType represents the type of monitor event
type X11MonitorEventType int

const (
	X11MonitorAdded X11MonitorEventType = iota
	X11MonitorRemoved
	X11MonitorChanged
)

func (t X11MonitorEventType) String() string {
	switch t {
	case X11MonitorAdded:
		return "Added"
	case X11MonitorRemoved:
		return "Removed"
	case X11MonitorChanged:
		return "Changed"
	default:
		return "Unknown"
	}
}

// X11MonitorEvent represents a change in monitor configuration
type X11MonitorEvent struct {
	Type    X11MonitorEventType
	Monitor X11MonitorInfo
}

// X11MonitorManager handles X11 monitor detection and event notification
type X11MonitorManager struct {
	ctx      *C.x11_context
	handle   cgo.Handle
	events   chan X11MonitorEvent
	done     chan struct{}
	wg       sync.WaitGroup
	mu       sync.Mutex
	monitors map[C.RROutput]X11MonitorInfo
}

// NewX11MonitorManager creates a new X11 monitor manager
func NewX11MonitorManager() (*X11MonitorManager, error) {
	mm := &X11MonitorManager{
		events:   make(chan X11MonitorEvent, 10),
		done:     make(chan struct{}),
		monitors: make(map[C.RROutput]X11MonitorInfo),
	}

	mm.handle = cgo.NewHandle(mm)

	mm.ctx = C.x11_init(unsafe.Pointer(&mm.handle))
	if mm.ctx == nil {
		mm.handle.Delete()
		return nil, fmt.Errorf("failed to connect to X11 display or RandR not available")
	}

	// Get initial monitors
	if err := mm.updateMonitorSnapshot(); err != nil {
		C.x11_cleanup(mm.ctx)
		mm.handle.Delete()
		return nil, err
	}

	return mm, nil
}

// Events returns the event channel (read-only)
func (mm *X11MonitorManager) Events() <-chan MonitorEvent {
	x11Events := mm.events
	events := make(chan MonitorEvent, 10)

	go func() {
		for event := range x11Events {
			events <- MonitorEvent{
				Type:    event.Type.String(),
				Monitor: convertX11MonitorToUnified(event.Monitor),
			}
		}
		close(events)
	}()

	return events
}

// GetMonitors returns a snapshot of current monitors as a map
func (mm *X11MonitorManager) GetMonitors() Monitors {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitors := make(Monitors)
	for _, m := range mm.monitors {
		converted := convertX11MonitorToUnified(m)
		monitors[converted.Name] = converted
	}
	return monitors
}

// GetMonitorByName returns a monitor by its name
func (mm *X11MonitorManager) GetMonitorByName(name string) (types.Monitor, bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	for _, m := range mm.monitors {
		if m.Name == name {
			return convertX11MonitorToUnified(m), true
		}
	}
	return types.Monitor{}, false
}

// GetPrimaryMonitor returns the primary monitor
func (mm *X11MonitorManager) GetPrimaryMonitor() (types.Monitor, bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	for _, m := range mm.monitors {
		if m.Primary {
			return convertX11MonitorToUnified(m), true
		}
	}
	return types.Monitor{}, false
}

// GetCompositorInfo returns information about the current compositor
func (mm *X11MonitorManager) GetCompositorInfo() *types.CompositorInfo {
	return &types.CompositorInfo{
		Type: types.CompositorTypeX11,
	}
}

// Start begins monitoring for monitor changes
func (mm *X11MonitorManager) Start() error {
	mm.wg.Add(1)
	go mm.eventLoop()
	return nil
}

// Stop stops the monitor manager
func (mm *X11MonitorManager) Stop() {
	close(mm.done)
	mm.wg.Wait()

	if mm.ctx != nil {
		C.x11_cleanup(mm.ctx)
		mm.ctx = nil
	}

	mm.handle.Delete()
	close(mm.events)
}

// eventLoop processes X11 events using select on the X11 connection fd
func (mm *X11MonitorManager) eventLoop() {
	defer mm.wg.Done()

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

		// Wait with timeout so we can check done channel
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
				// Events available, will be processed on next iteration
				continue
			}
		}
	}
}

// updateMonitorSnapshot fetches current state
func (mm *X11MonitorManager) updateMonitorSnapshot() error {
	var count C.int
	cOutputs := C.x11_get_outputs(mm.ctx, &count)
	if cOutputs == nil && count == 0 {
		return nil
	}
	if cOutputs != nil {
		defer C.free(unsafe.Pointer(cOutputs))
	}

	return nil
}

// handleEvent is called from C when monitors change
func (mm *X11MonitorManager) handleEvent(eventType int, outputID C.RROutput, info *C.x11_output_info) {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	monitor := cX11OutputInfoToGo(info)

	switch eventType {
	case 0: // Added
		mm.monitors[outputID] = monitor
		select {
		case mm.events <- X11MonitorEvent{Type: X11MonitorAdded, Monitor: monitor}:
		case <-mm.done:
		}

	case 1: // Removed
		if old, exists := mm.monitors[outputID]; exists {
			delete(mm.monitors, outputID)
			select {
			case mm.events <- X11MonitorEvent{Type: X11MonitorRemoved, Monitor: old}:
			case <-mm.done:
			}
		}

	case 2: // Changed
		old := mm.monitors[outputID]
		if !x11MonitorsEqual(old, monitor) {
			mm.monitors[outputID] = monitor
			select {
			case mm.events <- X11MonitorEvent{Type: X11MonitorChanged, Monitor: monitor}:
			case <-mm.done:
			}
		}
	}
}

// Convert C x11_output_info to Go X11MonitorInfo
func cX11OutputInfoToGo(info *C.x11_output_info) X11MonitorInfo {
	return X11MonitorInfo{
		Name:           C.GoString(&info.name[0]),
		X:              int32(info.x),
		Y:              int32(info.y),
		Width:          int32(info.width),
		Height:         int32(info.height),
		PhysicalWidth:  int32(info.physical_width),
		PhysicalHeight: int32(info.physical_height),
		RefreshRate:    float64(info.refresh_rate),
		Primary:        info.primary != 0,
	}
}

// Compare two X11 monitors for equality
func x11MonitorsEqual(a, b X11MonitorInfo) bool {
	return a.Name == b.Name &&
		a.X == b.X &&
		a.Y == b.Y &&
		a.Width == b.Width &&
		a.Height == b.Height &&
		a.PhysicalWidth == b.PhysicalWidth &&
		a.PhysicalHeight == b.PhysicalHeight &&
		a.Primary == b.Primary
}

//export go_x11_monitor_event_callback
func go_x11_monitor_event_callback(context unsafe.Pointer, eventType C.int, outputID C.RROutput, info *C.x11_output_info) {
	handle := *(*cgo.Handle)(context)
	mm := handle.Value().(*X11MonitorManager)
	mm.handleEvent(int(eventType), outputID, info)
}

// convertX11MonitorToUnified converts X11MonitorInfo to types.Monitor
func convertX11MonitorToUnified(info X11MonitorInfo) types.Monitor {
	return types.Monitor{
		Name:         info.Name,
		Width:        int(info.Width),
		Height:       int(info.Height),
		CurrentImage: "", // Will be set by the manager
		Position: types.Position{
			X: int(info.X),
			Y: int(info.Y),
		},
	}
}
