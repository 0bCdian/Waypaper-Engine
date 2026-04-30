package healthhandler

import (
	"net/http"
	"os"
	"runtime"
	"time"

	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/image"
)

// HealthHandler handles health and info endpoints.
type HealthHandler struct {
	startTime  time.Time
	version    string
	shutdownFn func()
}

// NewHealthHandler creates a HealthHandler.
func NewHealthHandler(version string, shutdownFn func()) *HealthHandler {
	return &HealthHandler{
		startTime:  time.Now(),
		version:    version,
		shutdownFn: shutdownFn,
	}
}

// MonitorStackVersion increments when the daemon's monitor-discovery ABI changes materially.
// Clients in development use this to recycle a still-healthy but outdated long-lived process.
const MonitorStackVersion = 2

// Healthz handles GET /healthz.
//
// @Summary      Health check
// @Tags         health
// @Success      200  {object}  map[string]any
// @Router       /healthz [get]
func (h *HealthHandler) Healthz(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"status":                 "ok",
		"monitor_stack_version":  MonitorStackVersion,
		"monitor_provider_order": []string{"wayland-utauri", "wlr-randr", "xrandr"},
	})
}

// Info handles GET /info.
//
// @Summary      Daemon info
// @Tags         health
// @Success      200  {object}  map[string]any
// @Router       /info [get]
func (h *HealthHandler) Info(w http.ResponseWriter, r *http.Request) {
	hostname, _ := os.Hostname()

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"version":    h.version,
		"pid":        os.Getpid(),
		"hostname":   hostname,
		"uptime":     time.Since(h.startTime).String(),
		"go_version": runtime.Version(),
		"os":         runtime.GOOS,
		"arch":       runtime.GOARCH,
	})
}

// Capabilities handles GET /capabilities.
//
// @Summary      System capabilities
// @Tags         health
// @Success      200  {object}  map[string]any
// @Router       /capabilities [get]
func (h *HealthHandler) Capabilities(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"ffmpeg_available": image.ResolveFfmpeg() != "",
	})
}

// Shutdown handles POST /shutdown.
//
// @Summary      Graceful shutdown
// @Tags         health
// @Success      200  {object}  map[string]string
// @Router       /shutdown [post]
func (h *HealthHandler) Shutdown(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "shutting_down"})

	// Trigger shutdown asynchronously to allow the response to be sent.
	go func() {
		time.Sleep(100 * time.Millisecond)
		if h.shutdownFn != nil {
			h.shutdownFn()
		}
	}()
}
