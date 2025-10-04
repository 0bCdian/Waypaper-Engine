package backend

import (
	"fmt"
	"log/slog"
	"time"

	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/store"
)

// Media-aware backend extensions

// MediaCapabilities defines what media types a backend supports
type MediaCapabilities struct {
	SupportedTypes       []media.MediaType `json:"supportedTypes"`
	MaxDimensions        *DimensionLimit   `json:"maxDimensions,omitempty"`
	HardwareAcceleration bool              `json:"hardwareAcceleration"`
	SpecialFeatures      []string          `json:"specialFeatures"`
}

// DimensionLimit represents resolution limits
type DimensionLimit struct {
	MaxWidth  int `json:"maxWidth"`
	MaxHeight int `json:"maxHeight"`
}

// EnhancedBackendCapabilities extends BackendCapabilities with media awareness
type EnhancedBackendCapabilities struct {
	BackendCapabilities
	MediaCapabilities MediaCapabilities `json:"mediaCapabilities"`
}

// MediaBackend extends the base backend with media capabilities
type MediaBackend interface {
	Backend
	GetEnhancedCapabilities() EnhancedBackendCapabilities
	SupportsMediaType(mediaType media.MediaType) bool
	GetMediaTypes() []media.MediaType
	IsAvailableForMediaType(mediaType media.MediaType) bool
}

// BackendType extension for new media types
const (
	BackendMpv      BackendType = "mpv"
	BackendVlc      BackendType = "vlc"
	BackendFfplay   BackendType = "ffplay"
	BackendElectron BackendType = "electron-wallpaper"
	BackendWebGL    BackendType = "webgl-wallpaper"
	BackendThreeJS  BackendType = "threejs-wallpaper"
)

// BackendInfo contains detailed information about a backend
type BackendInfo struct {
	Type             BackendType                 `json:"type"`
	Name             string                      `json:"name"`
	Description      string                      `json:"description"`
	Available        bool                        `json:"available"`
	Capabilities     EnhancedBackendCapabilities `json:"capabilities"`
	LastChecked      time.Time                   `json:"lastChecked"`
	Version          *string                     `json:"version,omitempty"`
	PerformanceScore int                         `json:"score,omitempty"`
}

// MediaBackendManager manages backends with media-aware selection
type MediaBackendManager struct {
	backends map[BackendType]BackendInfo
	detector *media.Detector
	logger   *slog.Logger
	store    *store.Store
	config   *MediaBackendConfig
}

// MediaBackendConfig contains enhanced backend configuration
type MediaBackendConfig struct {
	DefaultImageType string `toml:"default_image_type"`
	DefaultVideoType string `toml:"default_video_type"`
	DefaultHtmlType  string `toml:"default_html_type"`
	Default3DType    string `toml:"default_3d_type"`
	FallbackType     string `toml:"fallback_type"`

	// Backend-specific configurations
	Mpv      MpvConfig      `toml:"mpv"`
	Vlc      VlcConfig      `toml:"vlc"`
	Ffplay   FfplayConfig   `toml:"ffplay"`
	Electron ElectronConfig `toml:"electron"`
	WebGL    WebGLConfig    `toml:"webgl"`
	ThreeJS  ThreeJSConfig  `toml:"threejs"`
}

// Backend-specific configurations

type MpvConfig struct {
	Fullscreen  bool    `toml:"fullscreen"`
	Stringaudio bool    `toml:"stringaudio"`
	NoCursor    bool    `toml:"no_cursor"`
	Volume      float64 `toml:"volume"`
	Speed       float64 `toml:"speed"`
	LoopFile    string  `toml:"loop_file"`
}

type VlcConfig struct {
	Fullscreen bool `toml:"fullscreen"`
	VideoOnly  bool `toml:"video_only"`
	Volume     int  `toml:"volume"`
}

type FfplayConfig struct {
	Volume      float64 `toml:"volume"`
	Loop        int     `toml:"loop"`
	Stringaudio bool    `toml:"stringaudio"`
}

type ElectronConfig struct {
	Width       int  `toml:"width"`
	Height      int  `toml:"height"`
	Frameless   bool `toml:"frameless"`
	Transparent bool `toml:"transparent"`
	DisableGPU  bool `toml:"disable_gpu"`
}

type WebGLConfig struct {
	Antialias    bool `toml:"antialias"`
	Alpha        bool `toml:"alpha"`
	Depth        bool `toml:"depth"`
	Stencil      bool `toml:"stencil"`
	PreserveDraw bool `toml:"preserve_drawing_buffer"`
}

type ThreeJSConfig struct {
	Renderer       string `toml:"renderer"`
	Antialias      bool   `toml:"antialias"`
	ShadowMap      bool   `toml:"shadow_map"`
	ToneMapping    string `toml:"tone_mapping"`
	OutputEncoding string `toml:"output_encoding"`
}

// NewMediaBackendManager creates a new media backend manager
func NewMediaBackendManager(logger *slog.Logger, store *store.Store, config *MediaBackendConfig) *MediaBackendManager {
	return &MediaBackendManager{
		backends: make(map[BackendType]BackendInfo),
		detector: media.NewDetector(),
		logger:   logger,
		store:    store,
		config:   config,
	}
}

// ScanAvailableBackends scans for available backends
func (mbm *MediaBackendManager) ScanAvailableBackends() map[BackendType]BackendInfo {
	backends := map[BackendType]BackendInfo{
		BackendSwww:     mbm.createSwwwBackendInfo(),
		BackendFeh:      mbm.createFehBackendInfo(),
		BackendNitrogen: mbm.createNitrogenBackendInfo(),
		BackendMpv:      mbm.createMpvBackendInfo(),
		BackendVlc:      mbm.createVlcBackendInfo(),
		BackendFfplay:   mbm.createFfplayBackendInfo(),
		BackendElectron: mbm.createElectronBackendInfo(),
		BackendWebGL:    mbm.createWebGLBackendInfo(),
		BackendThreeJS:  mbm.createThreeJSBackendInfo(),
	}

	// Check availability for each backend
	for backendType, info := range backends {
		available, err := mbm.checkBackendAvailability(backendType)
		info.Available = available
		if err != nil {
			mbm.logger.Warn("backend availability check failed", "backend", backendType, "error", err)
		}
		info.LastChecked = time.Now()
		info.PerformanceScore = mbm.calculateBackendScore(info)
		backends[backendType] = info
	}

	mbm.backends = backends
	return backends
}

// SelectBackend selects the optimal backend based on playlist config and media type
func (mbm *MediaBackendManager) SelectBackend(
	playlistConfig *store.BackendConfiguration,
	mediaType media.MediaType,
	monitorName string,
) (BackendInfo, error) {

	// Priority 1: Playlist-specific backend
	if playlistConfig != nil && playlistConfig.Type != "" {
		if backendInfo, exists := mbm.backends[BackendType(playlistConfig.Type)]; exists && backendInfo.Available {
			if mbm.backendSupportsMediaType(backendInfo, mediaType) {
				mbm.logger.Info("using playlist-specific backend", "backend", playlistConfig.Type, "mediaType", mediaType)
				return backendInfo, nil
			} else {
				mbm.logger.Warn("playlist backend doesn't support media type", "backend", playlistConfig.Type, "mediaType", mediaType)
			}
		}
	}

	// Priority 2: Fallback from playlist config
	if playlistConfig != nil && playlistConfig.FallbackTo != nil {
		fallbackType := BackendType(*playlistConfig.FallbackTo)
		if backendInfo, exists := mbm.backends[fallbackType]; exists && backendInfo.Available {
			if mbm.backendSupportsMediaType(backendInfo, mediaType) {
				mbm.logger.Info("using playlist fallback backend", "backend", fallbackType, "mediaType", mediaType)
				return backendInfo, nil
			}
		}
	}

	// Priority 3: Default backend from config for this media type
	defaultBackend := mbm.getDefaultBackendForMediaType(mediaType)
	if backendInfo, exists := mbm.backends[defaultBackend]; exists && backendInfo.Available {
		if mbm.backendSupportsMediaType(backendInfo, mediaType) {
			mbm.logger.Info("using default backend", "backend", defaultBackend, "mediaType", mediaType)
			return backendInfo, nil
		}
	}

	// Priority 4: Auto-select best available backend
	bestBackend := mbm.GetBestBackendForMedia(mediaType)
	if bestBackend.Type != "" {
		mbm.logger.Info("auto-selected best backend", "backend", bestBackend.Type, "mediaType", mediaType)
		return bestBackend, nil
	}

	return BackendInfo{}, fmt.Errorf("no suitable backend found for media type: %s", mediaType)
}

// GetBestBackendForMedia returns the best available backend for a media type
func (mbm *MediaBackendManager) GetBestBackendForMedia(mediaType media.MediaType) BackendInfo {
	var bestBackend BackendInfo
	bestScore := 0

	for _, backend := range mbm.backends {
		// Skip unavailable backends
		if !backend.Available {
			continue
		}

		// Check if backend supports this media type
		if !mbm.backendSupportsMediaType(backend, mediaType) {
			continue
		}

		// Use cached performance score
		if backend.PerformanceScore > bestScore {
			bestScore = backend.PerformanceScore
			bestBackend = backend
		}
	}

	return bestBackend
}

// GetBackendsForMediaType returns all backends that support a media type
func (mbm *MediaBackendManager) GetBackendsForMediaType(mediaType media.MediaType) []BackendInfo {
	var supported []BackendInfo

	for _, backend := range mbm.backends {
		if backend.Available && mbm.backendSupportsMediaType(backend, mediaType) {
			supported = append(supported, backend)
		}
	}

	return supported
}

// Helper functions

// checkBackendAvailability checks if a backend is available
func (mbm *MediaBackendManager) checkBackendAvailability(backendType BackendType) (bool, error) {
	switch backendType {
	case BackendSwww, BackendFeh, BackendNitrogen:
		// Check if command is available in PATH (simplified)
		return true, nil
	case BackendMpv, BackendVlc, BackendFfplay:
		return true, nil // Simplified for now
	case BackendElectron, BackendWebGL, BackendThreeJS:
		return true, nil // These are built-in backends
	default:
		return false, fmt.Errorf("unknown backend type: %s", backendType)
	}
}

// backendSupportsMediaType checks if a backend supports a media type
func (mbm *MediaBackendManager) backendSupportsMediaType(backend BackendInfo, mediaType media.MediaType) bool {
	for _, supportedType := range backend.Capabilities.MediaCapabilities.SupportedTypes {
		if supportedType == mediaType {
			return true
		}
	}
	return false
}

// calculateBackendScore calculates a performance score for a backend
func (mbm *MediaBackendManager) calculateBackendScore(backend BackendInfo) int {
	score := 0

	// Base score from capabilities
	if backend.Capabilities.MediaCapabilities.HardwareAcceleration {
		score += 20
	}
	if backend.Capabilities.Transitions {
		score += 15
	}
	if backend.Capabilities.MultiMonitor {
		score += 10
	}

	return score
}

// getDefaultBackendForMediaType returns the default backend for a media type
func (mbm *MediaBackendManager) getDefaultBackendForMediaType(mediaType media.MediaType) BackendType {
	switch mediaType {
	case media.MediaTypeImage:
		if mbm.config != nil {
			return BackendType(mbm.config.DefaultImageType)
		}
		return BackendSwww
	case media.MediaTypeVideo:
		if mbm.config != nil {
			return BackendType(mbm.config.DefaultVideoType)
		}
		return BackendMpv
	case media.MediaTypeHTML:
		if mbm.config != nil {
			return BackendType(mbm.config.DefaultHtmlType)
		}
		return BackendElectron
	case media.MediaType3D:
		if mbm.config != nil {
			return BackendType(mbm.config.Default3DType)
		}
		return BackendWebGL
	default:
		return BackendSwww // Safe fallback
	}
}

// Backend creation functions

func (mbm *MediaBackendManager) createSwwwBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendSwww,
		Name:        "SWWW",
		Description: "Modern Wayland wallpaper daemon with excellent transitions",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  true,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"transitions", "multi-monitor", "wayland-native"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createFehBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendFeh,
		Name:        "Feh",
		Description: "Lightweight image viewer with wallpaper support",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    false,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  false,
				BackgroundMode: false,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeImage},
				HardwareAcceleration: false,
				SpecialFeatures:      []string{"lightweight", "x11-native"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createNitrogenBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendNitrogen,
		Name:        "Nitrogen",
		Description: "Multi-monitor wallpaper setting utility",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    false,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  false,
				BackgroundMode: false,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeImage},
				HardwareAcceleration: false,
				SpecialFeatures:      []string{"multi-monitor", "gui-manager"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createMpvBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendMpv,
		Name:        "MPV",
		Description: "Powerful video player with wallpaper support",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   false,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  false,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeVideo, media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"video-decoding", "audio-support", "hardware-decoding"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createVlcBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendVlc,
		Name:        "VLC",
		Description: "Versatile media player with wallpaper capabilities",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   false,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    false,
				Filters:        true,
				RealTimeQuery:  false,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeVideo, media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"video-support", "audio-support", "streaming"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createFfplayBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendFfplay,
		Name:        "FFplay",
		Description: "Fast video player based on FFmpeg",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   false,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    false,
				Filters:        true,
				RealTimeQuery:  false,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeVideo},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"ffmpeg-decoding", "fast-playback"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createElectronBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendElectron,
		Name:        "Electron Wallpaper",
		Description: "Web-based interactive wallpapers using Electron",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  true,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaTypeHTML, media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"javascript-execution", "web3d-support", "css-animations"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createWebGLBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendWebGL,
		Name:        "WebGL Wallpaper",
		Description: "Real-time 3D rendered backgrounds using WebGL",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  true,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaType3D, media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"webgl", "real-time-3d", "shaders"},
			},
		},
	}
}

func (mbm *MediaBackendManager) createThreeJSBackendInfo() BackendInfo {
	return BackendInfo{
		Type:        BackendThreeJS,
		Name:        "Three.js Wallpaper",
		Description: "Advanced 3D graphics using Three.js",
		Capabilities: EnhancedBackendCapabilities{
			BackendCapabilities: BackendCapabilities{
				MultiMonitor:   true,
				Transitions:    true,
				ResizeOptions:  true,
				Positioning:    true,
				Filters:        true,
				RealTimeQuery:  true,
				BackgroundMode: true,
			},
			MediaCapabilities: MediaCapabilities{
				SupportedTypes:       []media.MediaType{media.MediaType3D, media.MediaTypeImage},
				HardwareAcceleration: true,
				SpecialFeatures:      []string{"threejs", "advanced-shading", "post-processing"},
			},
		},
	}
}
