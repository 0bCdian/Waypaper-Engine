package waylandutauri

import (
	"fmt"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

type loadTarget struct {
	Monitor uint32 `json:"monitor"`
	Target  string `json:"target"`
}

type loadRequest struct {
	Kind              string         `json:"kind,omitempty"`
	Target            string         `json:"target,omitempty"`
	Targets           []loadTarget   `json:"targets,omitempty"`
	AudioEnabled      bool           `json:"audio_enabled,omitempty"`
	Transition        string         `json:"transition,omitempty"`
	DurationMS        int            `json:"duration_ms,omitempty"`
	WaitForCompletion bool           `json:"wait_for_completion"`
	Parallax          map[string]any `json:"parallax,omitempty"`
}

func buildLoadRequest(req backend.WallpaperRequest, cfg *Config, monitorMap map[string]uint32) (loadRequest, error) {
	kind := "image"
	switch req.MediaType {
	case media.MediaTypeVideo:
		kind = "video"
	case media.MediaTypeWeb:
		kind = "web"
	case media.MediaTypeImage, media.MediaTypeGIF, "":
		kind = "image"
	default:
		return loadRequest{}, fmt.Errorf("wayland-utauri: unsupported media type %q", req.MediaType)
	}

	out := loadRequest{
		Kind:         kind,
		AudioEnabled: req.AudioEnabled,
		Transition:   cfg.Transition,
		DurationMS:   cfg.DurationMS,
		// Non-blocking: server returns 202 immediately while transitions run. Using true ties the
		// HTTP client deadline (request_timeout_ms, often ~1.5s) to transition duration and can
		// serialize the control server so /wallpaper/status also times out (see tiny_http / command queue).
		WaitForCompletion: false,
	}
	if cfg.ParallaxEnabled {
		out.Parallax = buildParallaxRequestBody(cfg)
	}

	switch req.Mode {
	case monitor.ModeClone, monitor.ModeExtend:
		out.Target = req.ImagePath
		return out, nil
	case monitor.ModeIndividual:
		if len(req.Monitors) == 0 {
			return loadRequest{}, fmt.Errorf("wayland-utauri: individual mode requires at least one monitor")
		}
		for _, m := range req.Monitors {
			id, ok := monitorMap[m.Name]
			if !ok {
				return loadRequest{}, fmt.Errorf("wayland-utauri: unknown monitor %q", m.Name)
			}
			out.Targets = append(out.Targets, loadTarget{
				Monitor: id,
				Target:  req.ImagePath,
			})
		}
		return out, nil
	default:
		return loadRequest{}, fmt.Errorf("wayland-utauri: unsupported monitor mode %q", req.Mode)
	}
}

type statusResponse struct {
	OK         bool   `json:"ok"`
	APIVersion string `json:"api_version"`
	Status     struct {
		Topology []topologyEntry `json:"topology"`
	} `json:"status"`
}

type topologyEntry struct {
	Monitor  uint32 `json:"monitor"`
	StableID string `json:"stable_id"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
}

func buildMonitorMap(topology []topologyEntry, engineMonitors []monitor.Monitor) map[string]uint32 {
	m := make(map[string]uint32, len(topology))

	// Primary strategy: match engine monitors to topology entries by geometry.
	for _, eng := range engineMonitors {
		for _, topo := range topology {
			if eng.X == topo.X && eng.Y == topo.Y && eng.Width == topo.Width && eng.Height == topo.Height {
				m[eng.Name] = topo.Monitor
				break
			}
		}
	}

	// Fallback: if geometry matching yielded nothing, use stable_id as the key
	// (preserves original behavior for topologies that use output names).
	if len(m) == 0 {
		for _, entry := range topology {
			name := entry.StableID
			if name == "" {
				name = fmt.Sprintf("WAYLAND-OUTPUT-%d", entry.Monitor)
			}
			m[name] = entry.Monitor
		}
	}

	return m
}
