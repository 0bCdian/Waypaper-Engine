package waylandutauri

import (
	"context"
	"fmt"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Below the native zwlr_output_management provider; used when that protocol is
// unavailable or declines, but the utauri control plane answers.
const utauriMonitorProviderPriority = 25

// utauriMonitorProvider lists monitors from GET /wallpaper/status topology on the control socket.
type utauriMonitorProvider struct {
	v *viper.Viper
}

// NewMonitorProvider returns a monitor.MonitorProvider backed by wayland-utauri's control API.
// Pass the same *viper.Viper used for daemon config; socket_path and API expectations are read
// from backend.wayland-utauri (and legacy backend.waylandutauri) when set, otherwise defaults
// match RegisterDefaults / defaultConfig (including defaultSocketPath).
func NewMonitorProvider(v *viper.Viper) monitor.MonitorProvider {
	return &utauriMonitorProvider{v: v}
}

func (p *utauriMonitorProvider) Name() string {
	return "wayland-utauri"
}

func (p *utauriMonitorProvider) Compositor() monitor.CompositorType {
	return monitor.CompositorWayland
}

func (p *utauriMonitorProvider) Priority() int {
	return utauriMonitorProviderPriority
}

func (p *utauriMonitorProvider) Detect(ctx context.Context) ([]monitor.Monitor, error) {
	cfg := p.controlConfig()
	if strings.TrimSpace(cfg.SocketPath) == "" {
		return nil, fmt.Errorf("%w: wayland-utauri socket_path not configured", monitor.ErrProviderNotApplicable)
	}
	client, err := newControlClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("%w: wayland-utauri control client init: %v", monitor.ErrProviderNotApplicable, err)
	}

	// Health check determines applicability — the control sidecar isn't
	// always running. A successful health check pins us as the chosen provider;
	// after that, status failures are real errors, not "try someone else."
	healthCtx, cancel := withHealthTimeout(ctx, cfg)
	if err := client.checkHealth(healthCtx); err != nil {
		cancel()
		return nil, fmt.Errorf("%w: wayland-utauri health check failed: %v", monitor.ErrProviderNotApplicable, err)
	}
	cancel()

	st, err := client.status(ctx)
	if err != nil {
		return nil, fmt.Errorf("wayland-utauri monitor provider: %w", err)
	}
	return topologyToEngineMonitors(st.Status.Topology), nil
}

// withHealthTimeout derives a short-lived context for the health-check probe
// from the configured request timeout (defaulting to 1500ms).
func withHealthTimeout(parent context.Context, cfg *Config) (context.Context, context.CancelFunc) {
	timeout := time.Duration(cfg.RequestTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}
	return context.WithTimeout(parent, timeout)
}

func topologyToEngineMonitors(topology []topologyEntry) []monitor.Monitor {
	out := make([]monitor.Monitor, 0, len(topology))
	for _, e := range topology {
		out = append(out, monitor.Monitor{
			Name:        e.Name,
			Width:       e.Width,
			Height:      e.Height,
			X:           e.X,
			Y:           e.Y,
			Scale:       1,
			RefreshRate: 0,
			Transform:   0,
		})
	}
	return out
}

// controlConfig builds connection settings for the control client (subset of full backend config).
func (p *utauriMonitorProvider) controlConfig() *Config {
	cfg := defaultConfig()
	if p.v == nil {
		return cfg
	}
	prefixes := []string{viperBackendKey + ".", viperBackendKeyLegacy + "."}
	getString := func(k string) string {
		for _, prefix := range prefixes {
			if val := p.v.GetString(prefix + k); val != "" {
				return val
			}
		}
		return ""
	}
	getInt := func(k string) int {
		for _, prefix := range prefixes {
			val := p.v.GetInt(prefix + k)
			if val != 0 {
				return val
			}
		}
		return 0
	}
	if val := getString("socket_path"); val != "" {
		cfg.SocketPath = val
	}
	if val := getString("expected_service"); val != "" {
		cfg.ExpectedService = val
	}
	if val := getString("expected_api_version"); val != "" {
		cfg.ExpectedAPIVersion = val
	}
	if val := getInt("request_timeout_ms"); val > 0 {
		cfg.RequestTimeoutMS = val
	}
	if val := getInt("load_timeout_ms"); val > 0 {
		cfg.LoadTimeoutMS = val
	}
	return cfg
}
