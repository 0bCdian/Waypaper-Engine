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

type transitionParamsBody struct {
	Bezier               [4]float32 `json:"bezier"`
	AngleDeg             float64    `json:"angle_deg"`
	OriginXPercent       float32    `json:"origin_x_percent"`
	OriginYPercent       float32    `json:"origin_y_percent"`
	WaveAmplitudePercent float32    `json:"wave_amplitude_percent"`
	WaveFrequency        float32    `json:"wave_frequency"`
}

type loadRequest struct {
	Kind              string                `json:"kind,omitempty"`
	Target            string                `json:"target,omitempty"`
	Targets           []loadTarget          `json:"targets,omitempty"`
	AudioEnabled      bool                  `json:"audio_enabled,omitempty"`
	Transition        string                `json:"transition,omitempty"`
	TransitionParams  *transitionParamsBody `json:"transition_params,omitempty"`
	DurationMS        int                   `json:"duration_ms,omitempty"`
	WaitForCompletion bool                  `json:"wait_for_completion"`
	Parallax          map[string]any        `json:"parallax,omitempty"`
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

	bezier := parseTransitionBezierOrDefault(cfg.TransitionBezier)
	out := loadRequest{
		Kind:         kind,
		AudioEnabled: req.AudioEnabled,
		Transition:   cfg.Transition,
		DurationMS:   cfg.DurationMS,
		TransitionParams: &transitionParamsBody{
			Bezier:               bezier,
			AngleDeg:             float64(cfg.TransitionAngleDeg),
			OriginXPercent:       float32(cfg.TransitionOriginXPct),
			OriginYPercent:       float32(cfg.TransitionOriginYPct),
			WaveAmplitudePercent: cfg.TransitionWaveAmplitudePercent,
			WaveFrequency:        cfg.TransitionWaveFrequency,
		},
		// Non-blocking: server returns 202 immediately while transitions run. Using true ties the
		// HTTP client deadline (request_timeout_ms, often ~1.5s) to transition duration and can
		// serialize the control server so /wallpaper/status also times out (see tiny_http / command queue).
		WaitForCompletion: false,
	}
	// HTML/web wallpapers: parallax is intentionally unsupported (no zoom/pan). Omit from load and
	// skip follow-up parallax sync in SetWallpaper (see waylandutauri.go).
	if kind != "web" {
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

type parallaxStateSnapshot struct {
	Enabled     bool       `json:"enabled"`
	Zoom        float32    `json:"zoom"`
	OffsetX     float32    `json:"offset_x"`
	OffsetY     float32    `json:"offset_y"`
	StepPercent float32    `json:"step_percent"`
	AnimationMS uint64     `json:"animation_ms"`
	Easing      [4]float32 `json:"easing"`
	ResetMS     uint64     `json:"reset_ms"`
}

type monitorStatusSnapshot struct {
	Monitor        uint32                `json:"monitor"`
	Visible        bool                  `json:"visible"`
	CurrentTarget  *string               `json:"current_target,omitempty"`
	PendingTarget  *string               `json:"pending_target,omitempty"`
	LastTransition string                `json:"last_transition"`
	InProgress     bool                  `json:"in_progress"`
	CurrentKind    string                `json:"current_kind"`
	PendingKind    *string               `json:"pending_kind,omitempty"`
	Parallax       parallaxStateSnapshot `json:"parallax"`
}

type schedulerSnapshot struct {
	Mode           string `json:"mode"`
	MaxQueueSize   int    `json:"max_queue_size"`
	QueuedRequests int    `json:"queued_requests"`
}

type playbackSnapshot struct {
	Mode           string `json:"mode"`
	DesktopFocused bool   `json:"desktop_focused"`
	Paused         bool   `json:"paused"`
	Reason         string `json:"reason"`
}

// wallpaperStatusPayload mirrors the `status` object from GET /wallpaper/status (wayland-utauri).
type wallpaperStatusPayload struct {
	TopologyPolicy string                  `json:"topology_policy"`
	MonitorCount   int                     `json:"monitor_count"`
	Topology       []topologyEntry         `json:"topology"`
	Monitors       []monitorStatusSnapshot `json:"monitors"`
	Scheduler      schedulerSnapshot       `json:"scheduler"`
	Playback       playbackSnapshot        `json:"playback"`
}

type statusResponse struct {
	OK         bool                   `json:"ok"`
	APIVersion string                 `json:"api_version"`
	Status     wallpaperStatusPayload `json:"status"`
}

type topologyEntry struct {
	Monitor  uint32  `json:"monitor"`
	StableID string  `json:"stable_id"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	X        int     `json:"x"`
	Y        int     `json:"y"`
	Model    *string `json:"model,omitempty"`
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
