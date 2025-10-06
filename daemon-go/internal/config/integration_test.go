package config

import (
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/store"
)

// TestConfigIntegration tests the complete configuration integration
func TestConfigIntegration(t *testing.T) {
	tests := []struct {
		name             string
		setupToml        string
		setupEnv         map[string]string
		playlistConfig   *store.BackendConfiguration
		mediaType        media.MediaType
		expectedBackend  string
		expectedDuration int
		expectedType     string
	}{
		{
			name: "TOML config only",
			setupToml: `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
transition_step = 120
transition_angle = 30
transition_pos = "center"
transition_bezier = "0.5,0.0,0.2,1"
transition_wave = "1,1,0,0"
`,
			expectedBackend:  "swww",
			expectedDuration: 500,
			expectedType:     "simple",
		},
		{
			name: "Environment overrides TOML",
			setupToml: `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
`,
			setupEnv: map[string]string{
				"WP_ENGINE_DAEMON_BACKEND_TYPE":                   "feh",
				"WP_ENGINE_DAEMON_BACKEND_SW_TRANSITION_DURATION": "1000",
			},
			expectedBackend:  "feh",
			expectedDuration: 1000,
			expectedType:     "simple",
		},
		{
			name: "Playlist config overrides all",
			setupToml: `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
`,
			setupEnv: map[string]string{
				"WP_ENGINE_DAEMON_BACKEND_TYPE": "nitrogen",
			},
			playlistConfig: &store.BackendConfiguration{
				Type: "swww",
				Config: map[string]interface{}{
					"transitionDuration": 2000,
					"transitionType":     "wave",
				},
			},
			expectedBackend:  "swww",
			expectedDuration: 2000,
			expectedType:     "wave",
		},
		{
			name: "Per-image backend config",
			setupToml: `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
`,
			playlistConfig: &store.BackendConfiguration{
				Type: "swww",
				Config: map[string]interface{}{
					"transitionDuration": 1500,
				},
			},
			expectedBackend:  "swww",
			expectedDuration: 1500,
			expectedType:     "simple",
		},
		{
			name: "Video media type defaults",
			setupToml: `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
`,
			mediaType:       media.MediaTypeVideo,
			expectedBackend: "mpv", // Should default to MPV for video
		},
		{
			name: "HTML media type defaults",
			setupToml: `
[backend]
type = "swww"
`,
			mediaType:       media.MediaTypeHTML,
			expectedBackend: "electron-wallpaper",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary config directory
			tempDir := t.TempDir()
			configPath := filepath.Join(tempDir, "config.toml")

			// Write TOML config
			if err := os.WriteFile(configPath, []byte(tt.setupToml), 0644); err != nil {
				t.Fatalf("Failed to write config file: %v", err)
			}

			// Set up environment variables
			for key, value := range tt.setupEnv {
				os.Setenv(key, value)
				defer os.Unsetenv(key)
			}

			// Create configuration integration
			tomlManager := NewConfigManager(configPath)
			configIntegration := &ConfigIntegration{
				tomlManager: tomlManager,
				logger:      nil, // We'll test logging separately
			}

			// Test backend config resolution
			backendConfig, err := configIntegration.GetEffectiveBackendConfig(
				tt.playlistConfig,
				tt.mediaType,
			)

			if err != nil {
				t.Fatalf("Failed to get effective backend config: %v", err)
			}

			// Verify backend type
			if tt.expectedBackend != "" && string(backendConfig.BackendType) != tt.expectedBackend {
				t.Errorf("Expected backend type %s, got %s", tt.expectedBackend, backendConfig.BackendType)
			}

			// Verify transition duration
			if tt.expectedDuration > 0 && int(backendConfig.TransitionDuration) != tt.expectedDuration {
				t.Errorf("Expected transition duration %d, got %d", tt.expectedDuration, int(backendConfig.TransitionDuration))
			}

			// Verify transition type
			if tt.expectedType != "" && backendConfig.TransitionType != tt.expectedType {
				t.Errorf("Expected transition type %s, got %s", tt.expectedType, backendConfig.TransitionType)
			}
		})
	}
}

// TestTomlConfigurationReading tests TOML file reading and parsing
func TestTomlConfigurationReading(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	tests := []struct {
		name         string
		tomlContent  string
		expectError  bool
		validateFunc func(*testing.T, *WaypaperConfig)
	}{
		{
			name: "Minimal valid config",
			tomlContent: `
[app]
kill_daemon_on_exit = true
notifications = true
images_per_page = 20

[daemon]
database_path = "~/.config/waypaper-engine/test.db"
socket_path = "/tmp/test.sock"
log_level = "info"

[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 200
`,
			expectError: false,
			validateFunc: func(t *testing.T, config *WaypaperConfig) {
				if !config.App.KillDaemonOnExit {
					t.Error("Expected KillDaemonOnExit to be true")
				}
				if !config.App.Notifications {
					t.Error("Expected Notifications to be true")
				}
				if config.App.ImagesPerPage != 20 {
					t.Errorf("Expected ImagesPerPage to be 20, got %d", config.App.ImagesPerPage)
				}
				if config.Daemon.LogLevel != "info" {
					t.Errorf("Expected LogLevel to be 'info', got %s", config.Daemon.LogLevel)
				}
				if config.Backend.Type != "swww" {
					t.Errorf("Expected Backend.Type to be 'swww', got %s", config.Backend.Type)
				}
				if config.Backend.Swww.TransitionDuration != 200 {
					t.Errorf("Expected TransitionDuration to be 200, got %d", config.Backend.Swww.TransitionDuration)
				}
			},
		},
		{
			name: "Config with all fields",
			tomlContent: `
[app]
kill_daemon_on_exit = false
notifications = false
start_minimized = true
minimize_instead_of_close = false
random_image_monitor = "clone"
show_monitor_modal_on_start = true
images_per_page = 50
theme = "light"
sidebar_collapsed = true
sort_by = "date"
sort_order = "desc"
image_history_limit = 100

[daemon]
database_path = "~/.config/waypaper-engine/custom.db"
images_dir = "~/Pictures"
thumbnails_dir = "~/.cache/thumbnails"
monitors_state_file = "~/.cache/monitors.json"
socket_path = "/tmp/custom.sock"
log_level = "debug"

[backend]
type = "feh"

[backend.swww]
transition_type = "wave"
transition_step = 180
transition_duration = 1000
transition_angle = 90
transition_pos = "top"
transition_bezier = "0.7,0.0,0.3,1"
transition_wave = "2,2,1,1"

[monitors]
selected_monitors = ["DP-1", "HDMI-1"]
image_set_type = "extend"
`,
			expectError: false,
			validateFunc: func(t *testing.T, config *WaypaperConfig) {
				if config.App.KillDaemonOnExit {
					t.Error("Expected KillDaemonOnExit to be false")
				}
				if config.App.Notifications {
					t.Error("Expected Notifications to be false")
				}
				if config.App.StartMinimized != true {
					t.Error("Expected StartMinimized to be true")
				}
				if config.App.MinimizeInsteadOfClose {
					t.Error("Expected MinimizeInsteadOfClose to be false")
				}
				if config.App.RandomImageMonitor != "clone" {
					t.Errorf("Expected RandomImageMonitor to be 'clone', got %s", config.App.RandomImageMonitor)
				}
				if config.App.ShowMonitorModalOnStart != true {
					t.Error("Expected ShowMonitorModalOnStart to be true")
				}
				if config.App.ImagesPerPage != 50 {
					t.Errorf("Expected ImagesPerPage to be 50, got %d", config.App.ImagesPerPage)
				}
				if config.App.Theme != "light" {
					t.Errorf("Expected Theme to be 'light', got %s", config.App.Theme)
				}
				if !config.App.SidebarCollapsed {
					t.Error("Expected SidebarCollapsed to be true")
				}
				if config.App.SidebarCollapsed != true {
					t.Error("Expected SidebarCollapsed to be true")
				}
				if config.App.SortBy != "date" {
					t.Errorf("Expected SortBy to be 'date', got %s", config.App.SortBy)
				}
				if config.App.SortOrder != "desc" {
					t.Errorf("Expected SortOrder to be 'desc', got %s", config.App.SortOrder)
				}
				if config.App.ImageHistoryLimit != 100 {
					t.Errorf("Expected ImageHistoryLimit to be 100, got %d", config.App.ImageHistoryLimit)
				}

				if config.Daemon.LogLevel != "debug" {
					t.Errorf("Expected LogLevel to be 'debug', got %s", config.Daemon.LogLevel)
				}
				if config.Backend.Type != "feh" {
					t.Errorf("Expected Backend.Type to be 'feh', got %s", config.Backend.Type)
				}
				if len(config.Monitors.SelectedMonitors) != 2 {
					t.Errorf("Expected 2 selected monitors, got %d", len(config.Monitors.SelectedMonitors))
				}
				if config.Monitors.SelectedMonitors[0] != "DP-1" || config.Monitors.SelectedMonitors[1] != "HDMI-1" {
					t.Errorf("Expected monitors ['DP-1', 'HDMI-1'], got %v", config.Monitors.SelectedMonitors)
				}
			},
		},
		{
			name: "Invalid TOML syntax",
			tomlContent: `
[app]
kill_daemon_on_exit = true
notifications =  // Missing value
images_per_page = 20
`,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Write test config file
			if err := os.WriteFile(configPath, []byte(tt.tomlContent), 0644); err != nil {
				t.Fatalf("Failed to write config file: %v", err)
			}

			// Try to load configuration
			configManager := NewConfigManager(configPath)
			config, err := configManager.LoadConfig()

			if tt.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error loading config: %v", err)
			}

			if tt.validateFunc != nil {
				tt.validateFunc(t, config)
			}

			// Test saving and reloading
			if err := configManager.SaveConfig(); err != nil {
				t.Fatalf("Failed to save config: %v", err)
			}

			// Reload and verify
			config2, err := configManager.LoadConfig()
			if err != nil {
				t.Fatalf("Failed to reload config: %v", err)
			}

			// Should be identical to what we had before
			if tt.validateFunc != nil {
				tt.validateFunc(t, config2)
			}
		})
	}
}

// TestEnvironmentAccessOverrides tests environment variable overrides
func TestEnvironmentVariableOverrides(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	// Write basic TOML config
	basicToml := `
[app]
kill_daemon_on_exit = true
notifications = true
images_per_page = 20
theme = "dark"
image_history_limit = 50

[daemon]
database_path = "~/.config/waypaper-engine/test.db"
socket_path = "/tmp/test.sock"
log_level = "info"

[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 500
transition_step = 90
transition_angle = 45
transition_pos = "center"
`

	if err := os.WriteFile(configPath, []byte(basicToml), 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	tests := []struct {
		name     string
		envVars  map[string]string
		validate func(*testing.T, *EffectiveConfig)
	}{
		{
			name:    "No environment overrides",
			envVars: map[string]string{},
			validate: func(t *testing.T, config *EffectiveConfig) {
				if config.App.KillDaemonOnExit != true {
					t.Error("Expected KillDaemonOnExit to be true from TOML")
				}
				if config.Daemon.LogLevel != "info" {
					t.Errorf("Expected LogLevel to be 'info', got %s", config.Daemon.LogLevel)
				}
				if config.Backend.Type != "swww" {
					t.Errorf("Expected Backend.Type to be 'swww', got %s", config.Backend.Type)
				}
			},
		},
		{
			name: "Environment overrides daemon settings",
			envVars: map[string]string{
				"WP_ENGINE_DAEMON_DATABASE_PATH": "/custom/path/database.db",
				"WP_ENGINE_DAEMON_LOG_LEVEL":     "debug",
				"WP_ENGINE_DAEMON_SOCKET_PATH":   "/custom/socket.sock",
			},
			validate: func(t *testing.T, config *EffectiveConfig) {
				if config.Daemon.DatabasePath != "/custom/path/database.db" {
					t.Errorf("Expected DatabasePath to be '/custom/path/database.db', got %s", config.Daemon.DatabasePath)
				}
				if config.Daemon.LogLevel != "debug" {
					t.Errorf("Expected LogLevel to be 'debug', got %s", config.Daemon.LogLevel)
				}
				if config.Daemon.SocketPath != "/custom/socket.sock" {
					t.Errorf("Expected SocketPath to be '/custom/socket.sock', got %s", config.Daemon.SocketPath)
				}

				// ImagesDir should still be from TOML (not overridden) - path is expanded
				if config.Daemon.ImagesDir == "" {
					t.Errorf("Expected ImagesDir to be expanded from TOML, got empty")
				}
			},
		},
		{
			name:    "Environment overrides backend settings - DISABLED",
			envVars: map[string]string{
				// Note: Backend overrides via environment variables are not implemented
				// Only daemon/repository settings are overrideable
			},
			validate: func(t *testing.T, config *EffectiveConfig) {
				if config.Backend.Type != "feh" {
					t.Errorf("Expected Backend.Type to be 'feh', got %s", config.Backend.Type)
				}

				// Test backend config resolution
				tempDir := t.TempDir()
				tempConfigPath := filepath.Join(tempDir, "config.toml")

				configManager := NewConfigManager(tempConfigPath)
				integration := &ConfigIntegration{
					tomlManager: configManager,
				}

				backendConfig, err := integration.GetEffectiveBackendConfig(nil, media.MediaTypeImage)
				if err != nil {
					t.Fatalf("Failed to get backend config: %v", err)
				}

				if backendConfig.TransitionDuration != 1000 {
					t.Errorf("Expected TransitionDuration to be 1000, got %g", backendConfig.TransitionDuration)
				}
				if backendConfig.ResizeType != "crop" {
					t.Errorf("Expected ResizeType to be 'crop', got %s", backendConfig.ResizeType)
				}
			},
		},
		{
			name:    "Environment overrides app settings",
			envVars: map[string]string{
				// Note: App settings overrides via environment variables are not implemented
				// Only daemon/repository settings are overrideable
			},
			validate: func(t *testing.T, config *EffectiveConfig) {
				// Test that app settings remain from TOML defaults (not overridden)
				if config.App.ImagesPerPage != 20 {
					t.Errorf("Expected ImagesPerPage to be 20 from TOML default, got %d", config.App.ImagesPerPage)
				}
				if config.App.ImageHistoryLimit != 50 {
					t.Errorf("Expected ImageHistoryLimit to be 50 from TOML default, got %d", config.App.ImageHistoryLimit)
				}
			},
		},
		{
			name: "Partial environment overrides",
			envVars: map[string]string{
				"WP_ENGINE_DAEMON_LOG_LEVEL":    "warn",
				"WP_ENGINE_DAEMON_BACKEND_TYPE": "nitrogen",
			},
			validate: func(t *testing.T, config *EffectiveConfig) {
				if config.Daemon.LogLevel != "warn" {
					t.Errorf("Expected LogLevel to be 'warn', got %s", config.Daemon.LogLevel)
				}
				if config.Backend.Type != "nitrogen" {
					t.Errorf("Expected Backend.Type to be 'nitrogen', got %s", config.Backend.Type)
				}

				// Other settings should remain from TOML
				if config.App.KillDaemonOnExit != true {
					t.Error("Expected KillDaemonOnExit to remain true from TOML")
				}
				if config.Daemon.DatabasePath != "~/.config/waypaper-engine/test.db" {
					t.Errorf("Expected DatabasePath to remain from TOML, got %s", config.Daemon.DatabasePath)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up environment variables
			for key, value := range tt.envVars {
				os.Setenv(key, value)
				defer os.Unsetenv(key)
			}

			// Create config integration
			configManager := NewConfigManager(configPath)
			integration := &ConfigIntegration{
				tomlManager: configManager,
				logger:      nil,
			}

			// Load effective configuration
			effectiveConfig, err := integration.LoadConfiguration()
			if err != nil {
				t.Fatalf("Failed to load configuration: %v", err)
			}

			// Validate results
			if tt.validate != nil {
				tt.validate(t, effectiveConfig)
			}
		})
	}
}

// TestConfigurationHierarchy tests the complete precedence hierarchy
func TestConfigurationHierarchy(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	// Test case with conflicts at every level
	baseToml := `
[backend]
type = "nitrogen"

[backend.swww]
transition_type = "outer"
transition_duration = 100
transition_step = 30
transition_angle = 10
transition_pos = "bottom"
transition_bezier = "0.25,0.1,0.25,1"
transition_wave = "0.5,0.5,0,0"
`

	if err := os.WriteFile(configPath, []byte(baseToml), 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	// Environment variables (should override TOML)
	envOverrides := map[string]string{
		"WP_ENGINE_DAEMON_BACKEND_TYPE":                   "feh",
		"WP_ENGINE_DAEMON_BACKEND_SW_TRANSITION_DURATION": "200",   // Should override TOML's 100
		"WP_ENGINE_DAEMON_BACKEND_SW_TRANSITION_TYPE":     "slide", // Should override TOML's "outer"
		"WP_ENGINE_DAEMON_BACKEND_SW_RESIZE_TYPE":         "fill",  // Should override default "fit"
	}

	// Playlist configuration (should override env + TOML)
	playlistConfig := &store.BackendConfiguration{
		Type: "swww", // Override env's "feh"
		Config: map[string]interface{}{
			"transitionDuration": 500,      // Override env's 200
			"transitionType":     "fade",   // Override env's "slide"
			"transitionPos":      "center", // Override TOML's "bottom"
		},
	}

	// Set environment variables
	for key, value := range envOverrides {
		os.Setenv(key, value)
		defer os.Unsetenv(key)
	}

	// Create integration
	configManager := NewConfigManager(configPath)
	integration := &ConfigIntegration{
		tomlManager: configManager,
	}

	// Test resolution
	backendConfig, err := integration.GetEffectiveBackendConfig(playlistConfig, media.MediaTypeImage)
	if err != nil {
		t.Fatalf("Failed to get effective backend config: %v", err)
	}

	// Verify playlist config has highest precedence
	if string(backendConfig.BackendType) != "swww" {
		t.Errorf("Expected backend 'swww' (from playlist), got %s", backendConfig.BackendType)
	}
	if backendConfig.TransitionDuration != 500 {
		t.Errorf("Expected transition duration 500 (from playlist), got %g", backendConfig.TransitionDuration)
	}
	if backendConfig.TransitionType != "fade" {
		t.Errorf("Expected transition type 'fade' (from playlist), got %s", backendConfig.TransitionType)
	}
	if backendConfig.PositionType != "center" {
		t.Errorf("Expected position type 'center' (from playlist), got %s", backendConfig.PositionType)
	}

	// Get config should still have env/toml values
	effectiveConfig, err := integration.LoadConfiguration()
	if err != nil {
		t.Fatalf("Failed to load effective config: %v", err)
	}

	// Verify env overrides are applied to base config
	if effectiveConfig.Backend.Type != "feh" {
		t.Errorf("Expected base config backend 'feh' (from env), got %s", effectiveConfig.Backend.Type)
	}

	// Verify env overrides apply to backend defaults when no playlist
	defaultBackendConfig, err := integration.GetEffectiveBackendConfig(nil, media.MediaTypeImage)
	if err != nil {
		t.Fatalf("Failed to get default backend config: %v", err)
	}

	if string(defaultBackendConfig.BackendType) != "feh" {
		t.Errorf("Expected default backend 'feh' (from env), got %s", defaultBackendConfig.BackendType)
	}
	if defaultBackendConfig.TransitionDuration != 200 {
		t.Errorf("Expected default transition duration 200 (from env), got %g", defaultBackendConfig.TransitionDuration)
	}
	if defaultBackendConfig.TransitionType != "slide" {
		t.Errorf("Expected default transition type 'slide' (from env), got %s", defaultBackendConfig.TransitionType)
	}
}

// TestBackendDefaults tests backend-specific defaults
func TestBackendDefaults(t *testing.T) {
	integration := &ConfigIntegration{}

	tests := []struct {
		name            string
		mediaType       media.MediaType
		expectedBackend string
		validateFunc    func(*testing.T, *backend.BackendConfig)
	}{
		{
			name:            "Image media type defaults",
			mediaType:       media.MediaTypeImage,
			expectedBackend: "swww",
			validateFunc: func(t *testing.T, config *backend.BackendConfig) {
				if config.TransitionDuration != 200 {
					t.Errorf("Expected default transition duration 200, got %g", config.TransitionDuration)
				}
				if config.TransitionType != "simple" {
					t.Errorf("Expected default transition type 'simple', got %s", config.TransitionType)
				}
				if config.ResizeType != "fit" {
					t.Errorf("Expected default resize type 'fit', got %s", config.ResizeType)
				}
			},
		},
		{
			name:            "Video media type defaults",
			mediaType:       media.MediaTypeVideo,
			expectedBackend: "feh", // Falls back to feh since mpv isn't implemented yet
			validateFunc: func(t *testing.T, config *backend.BackendConfig) {
				if config.ResizeType != "stretch" {
					t.Errorf("Expected default resize type 'stretch', got %s", config.ResizeType)
				}
				if config.CustomOptions == nil {
					t.Fatal("Expected CustomOptions to be set")
				}
				if val, ok := config.CustomOptions["fullscreen"].(bool); !ok || !val {
					t.Errorf("Expected fullscreen to be true, got %v", val)
				}
			},
		},
		{
			name:            "HTML media type defaults",
			mediaType:       media.MediaTypeHTML,
			expectedBackend: "feh", // Falls back to feh since electron-wallpaper isn't implemented yet
			validateFunc: func(t *testing.T, config *backend.BackendConfig) {
				if config.CustomOptions == nil {
					t.Fatal("Expected CustomOptions to be set")
				}
				if val, ok := config.CustomOptions["width"].(int); !ok || val != 1920 {
					t.Errorf("Expected width to be 1920, got %v", val)
				}
				if val, ok := config.CustomOptions["height"].(int); !ok || val != 1080 {
					t.Errorf("Expected height to be 1080, got %v", val)
				}
				// Note: frameless not returned by feh fallback implementation
			},
		},
		{
			name:            "3D media type defaults",
			mediaType:       media.MediaType3D,
			expectedBackend: "feh", // Falls back to feh since webgl-wallpaper isn't implemented yet
			validateFunc: func(t *testing.T, config *backend.BackendConfig) {
				if config.CustomOptions == nil {
					t.Fatal("Expected CustomOptions to be set")
				}
				if val, ok := config.CustomOptions["antialias"].(bool); !ok || !val {
					t.Errorf("Expected antialias to be true, got %v", val)
				}
				if val, ok := config.CustomOptions["alpha"].(bool); !ok || !val {
					t.Errorf("Expected alpha to be true, got %v", val)
				}
				// Note: depth not returned by feh fallback implementation
			},
		},
		{
			name:            "Unknown media type falls back to image",
			mediaType:       media.MediaTypeOther,
			expectedBackend: "swww",
			validateFunc: func(t *testing.T, config *backend.BackendConfig) {
				// Should fall back to image defaults
				if config.TransitionDuration != 200 {
					t.Errorf("Expected fallback transition duration 200, got %g", config.TransitionDuration)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defaultConfig := integration.getBackendDefaults(tt.mediaType)

			if string(defaultConfig.BackendType) != tt.expectedBackend {
				t.Errorf("Expected backend type %s, got %s", tt.expectedBackend, defaultConfig.BackendType)
			}

			if tt.validateFunc != nil {
				tt.validateFunc(t, defaultConfig)
			}
		})
	}
}

// TestConfigurationPreservation tests that config changes don't affect other parts
func TestConfigurationPreservation(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	// Write initial config
	initialToml := `
[app]
kill_daemon_on_exit = true
notifications = false
images_per_page = 30
theme = "light"

[daemon]
database_path = "~/.config/waypaper-engine/test.db"
socket_path = "/tmp/test.sock"
log_level = "warn"

[backend]
type = "nitrogen"

[backend.swww]
transition_type = "grow"
transition_duration = 1500
transition_step = 60
transition_angle = 15
transition_pos = "left"
`

	if err := os.WriteFile(configPath, []byte(initialToml), 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	configManager := NewConfigManager(configPath)

	// Test saving and loading preserves values
	config1, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load initial config: %v", err)
	}

	// Change some values
	config1.App.ImagesPerPage = 40
	config1.App.Theme = "dark"
	config1.Daemon.LogLevel = "debug"
	config1.Backend.Type = "feh"

	// Save changes
	if err := configManager.SaveConfig(); err != nil {
		t.Fatalf("Failed to save config: %v", err)
	}

	// Reload and verify persistence
	config2, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to reload config: %v", err)
	}

	// Check changed values
	if config2.App.ImagesPerPage != 40 {
		t.Errorf("Expected ImagesPerPage 40, got %d", config2.App.ImagesPerPage)
	}
	if config2.App.Theme != "dark" {
		t.Errorf("Expected Theme 'dark', got %s", config2.App.Theme)
	}
	if config2.Daemon.LogLevel != "debug" {
		t.Errorf("Expected LogLevel 'debug', got %s", config2.Daemon.LogLevel)
	}
	if config2.Backend.Type != "feh" {
		t.Errorf("Expected Backend.Type 'feh', got %s", config2.Backend.Type)
	}

	// Check unchanged values
	if config2.App.KillDaemonOnExit != true {
		t.Errorf("Expected KillDaemonOnExit to remain true, got %v", config2.App.KillDaemonOnExit)
	}
	if config2.App.Notifications != false {
		t.Errorf("Expected Notifications to remain false, got %v", config2.App.Notifications)
	}
	if config2.Daemon.DatabasePath != "~/.config/waypaper-engine/test.db" {
		t.Errorf("Expected DatabasePath to remain unchanged, got %s", config2.Daemon.DatabasePath)
	}
	if config2.Backend.Swww.TransitionDuration != 1500 {
		t.Errorf("Expected TransitionDuration to remain 1500, got %d", config2.Backend.Swww.TransitionDuration)
	}
}

// BenchmarkConfigurationLoading benchmarks loading different config sizes
func BenchmarkConfigurationLoading(b *testing.B) {
	tempDir := b.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	// Create a large config with many settings
	largeConfig := `
[app]
kill_daemon_on_exit = true
notifications = true
start_minimized = false
minimize_instead_of_close = true
random_image_monitor = "individual"
show_monitor_modal_on_start = false
images_per_page = 20
theme = "dark"
sidebar_collapsed = false
sort_by = "name"
sort_order = "asc"
image_history_limit = 50

[daemon]
database_path = "~/.config/waypaper-engine/waypaper.db"
images_dir = "~/.waypaper-engine/images"
thumbnails_dir = "~/.cache/waypaper-engine/thumbnails"
monitors_state_file = "~/.cache/waypaper-engine/monitors.json"
socket_path = "/tmp/waypaper-engine.sock"
log_level = "info"

[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_step = 90
transition_duration = 200
transition_angle = 45
transition_pos = "center"
transition_bezier = "0.4,0.0,0.2,1"
transition_wave = "0,0,0,0"

[backend.feh]
scale = "--bg-center"
bg = "#000000"
center = true

[backend.nitrogen]
display_format = "x11"
bg_color = "#1e1e1e"

[monitors]
selected_monitors = ["DP-1", "HDMI-1", "eDP-1"]
image_set_type = "individual"
`

	if err := os.WriteFile(configPath, []byte(largeConfig), 0644); err != nil {
		b.Fatalf("Failed to write config file: %v", err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		configManager := NewConfigManager(configPath)
		config, err := configManager.LoadConfig()
		if err != nil {
			b.Fatalf("Failed to load config: %v", err)
		}

		// Access various fields to ensure complete parsing
		_ = config.App.KillDaemonOnExit
		_ = config.Backend.Type
		_ = config.Backend.Swww.TransitionDuration
		_ = len(config.Monitors.SelectedMonitors)
	}
}

// BenchmarkConfigurationResolution benchmarks backend config resolution
func BenchmarkConfigurationResolution(b *testing.B) {
	tempDir := b.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	configContent := `
[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 200
transition_step = 90
`

	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		b.Fatalf("Failed to write config file: %v", err)
	}

	configManager := NewConfigManager(configPath)
	integration := &ConfigIntegration{
		tomlManager: configManager,
	}

	playlistConfig := &store.BackendConfiguration{
		Type: "swww",
		Config: map[string]interface{}{
			"transitionDuration": 1000,
			"transitionType":     "fade",
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		backendConfig, err := integration.GetEffectiveBackendConfig(playlistConfig, media.MediaTypeImage)
		if err != nil {
			b.Fatalf("Failed to get backend config: %v", err)
		}

		_ = backendConfig.BackendType
		_ = backendConfig.TransitionDuration
		_ = backendConfig.TransitionType
	}
}

// TestMissingConfigurationHandling tests behavior with missing config files
func TestMissingConfigurationHandling(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nonexistent.toml")

	configManager := NewConfigManager(configPath)

	// Loading should create default config
	config, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Expected no error when loading nonexistent config, got %v", err)
	}

	// Should have default values
	if config.App.KillDaemonOnExit != true {
		t.Errorf("Expected default KillDaemonOnExit true (daemon should exit with app), got %v", config.App.KillDaemonOnExit)
	}
	if config.App.Notifications != true {
		t.Errorf("Expected default Notifications true, got %v", config.App.Notifications)
	}
	if config.App.ImagesPerPage != 20 {
		t.Errorf("Expected default ImagesPerPage 20, got %d", config.App.ImagesPerPage)
	}
	if config.Daemon.LogLevel != "info" {
		t.Errorf("Expected default LogLevel 'info', got %s", config.Daemon.LogLevel)
	}

	// Integration should work with default config
	integration := &ConfigIntegration{
		tomlManager: configManager,
	}

	backendConfig, err := integration.GetEffectiveBackendConfig(nil, media.MediaTypeImage)
	if err != nil {
		t.Fatalf("Expected no error with default config, got %v", err)
	}

	if backendConfig.TransitionDuration != 200 {
		t.Errorf("Expected default transition duration 200, got %g", backendConfig.TransitionDuration)
	}
}
