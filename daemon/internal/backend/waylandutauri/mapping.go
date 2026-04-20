package waylandutauri

import (
	"encoding/json"
	"fmt"
	"strings"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

type loadTarget struct {
	Name   string `json:"name"`
	Target string `json:"target"`
	// Kind mirrors the top-level load kind so wal-utauri can resolve each monitor even if the
	// root `kind` field is omitted or mishandled by a proxy.
	Kind string `json:"kind,omitempty"`
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
	Kind                  string                `json:"kind,omitempty"`
	Target                string                `json:"target,omitempty"`
	Targets               []loadTarget          `json:"targets,omitempty"`
	AudioEnabled          bool                  `json:"audio_enabled,omitempty"`
	Transition            string                `json:"transition,omitempty"`
	TransitionParams      *transitionParamsBody `json:"transition_params,omitempty"`
	DurationMS            int                   `json:"duration_ms,omitempty"`
	ImageFitMode          string                `json:"image_fit_mode,omitempty"`
	ImageRendering        string                `json:"image_rendering,omitempty"`
	WaitForCompletion     bool                  `json:"wait_for_completion"`
	Parallax              map[string]any        `json:"parallax,omitempty"`
	WallpaperConfigValues json.RawMessage       `json:"wallpaper_config_values,omitempty"`
}

func buildLoadRequest(req backend.WallpaperRequest, cfg *Config) (loadRequest, error) {
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
		WaitForCompletion: false,
	}
	out.Parallax = buildParallaxRequestBody(cfg)
	if kind == "image" {
		out.ImageFitMode = cfg.ImageFitMode
		out.ImageRendering = cfg.ImageRendering
	}
	if kind == "web" && len(req.WallpaperConfigValues) > 0 {
		out.WallpaperConfigValues = req.WallpaperConfigValues
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
			name := strings.TrimSpace(m.Name)
			if name == "" {
				return loadRequest{}, fmt.Errorf("wayland-utauri: monitor has empty name")
			}
			out.Targets = append(out.Targets, loadTarget{
				Name:   name,
				Target: req.ImagePath,
				Kind:   kind,
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
	Name           string                `json:"name"`
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
	Name   string  `json:"name"`
	Width  int     `json:"width"`
	Height int     `json:"height"`
	X      int     `json:"x"`
	Y      int     `json:"y"`
	Model  *string `json:"model,omitempty"`
}

const topologyGeometryEpsilonPx = 2.0

// TopologyMonitorMatch returns the compositor output name whose geometry matches bounds.
func TopologyMonitorMatch(topo []topologyEntry, x, y, width, height float64) (string, bool) {
	for _, e := range topo {
		if approxEqTopology(float64(e.X), x) &&
			approxEqTopology(float64(e.Y), y) &&
			approxEqTopology(float64(e.Width), width) &&
			approxEqTopology(float64(e.Height), height) {
			return e.Name, true
		}
	}
	return "", false
}

// TopologyMonitorContainingCenter returns the topology entry whose rectangle contains
// the center of bounds, preferring the smallest area when rects overlap (unlikely).
func TopologyMonitorContainingCenter(topo []topologyEntry, x, y, width, height float64) (string, bool) {
	if width <= 0 || height <= 0 {
		return "", false
	}
	cx := x + width*0.5
	cy := y + height*0.5
	var best *topologyEntry
	var bestArea int64 = 1<<62 - 1
	for i := range topo {
		e := &topo[i]
		ex, ey := float64(e.X), float64(e.Y)
		ew, eh := float64(e.Width), float64(e.Height)
		if cx < ex || cx > ex+ew || cy < ey || cy > ey+eh {
			continue
		}
		area := int64(e.Width) * int64(e.Height)
		if area < bestArea {
			best = e
			bestArea = area
		}
	}
	if best != nil {
		return best.Name, true
	}
	return "", false
}

// TopologyMonitorMatchByPosition returns the topology entry whose X, Y matches bounds origin.
func TopologyMonitorMatchByPosition(topo []topologyEntry, x, y float64) (string, bool) {
	for _, e := range topo {
		if approxEqTopology(float64(e.X), x) && approxEqTopology(float64(e.Y), y) {
			return e.Name, true
		}
	}
	return "", false
}

// ResolveParallaxMonitor picks a compositor output name using geometry-derived topology matching.
func ResolveParallaxMonitor(topo []topologyEntry, boundsX, boundsY, boundsW, boundsH float64) (string, bool) {
	if n, ok := TopologyMonitorMatch(topo, boundsX, boundsY, boundsW, boundsH); ok {
		return n, true
	}
	if n, ok := TopologyMonitorMatchByPosition(topo, boundsX, boundsY); ok {
		return n, true
	}
	if n, ok := TopologyMonitorContainingCenter(topo, boundsX, boundsY, boundsW, boundsH); ok {
		return n, true
	}
	return "", false
}

func approxEqTopology(a, b float64) bool {
	d := a - b
	if d < 0 {
		d = -d
	}
	return d <= topologyGeometryEpsilonPx
}
