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
func (h *HealthHandler) Healthz(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, HealthzResponse{
		Status:               "ok",
		MonitorStackVersion:  MonitorStackVersion,
		MonitorProviderOrder: []string{"wal-qt", "wlr-randr", "xrandr"},
	})
}

// Info handles GET /info.
func (h *HealthHandler) Info(w http.ResponseWriter, r *http.Request) {
	hostname, _ := os.Hostname()

	httpjson.WriteJSON(w, http.StatusOK, InfoResponse{
		Version:   h.version,
		PID:       os.Getpid(),
		Hostname:  hostname,
		Uptime:    time.Since(h.startTime).String(),
		GoVersion: runtime.Version(),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
	})
}

// Capabilities handles GET /capabilities.
func (h *HealthHandler) Capabilities(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, CapabilitiesResponse{
		FfmpegAvailable: image.ResolveFfmpeg() != "",
	})
}

// Shutdown handles POST /shutdown.
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
