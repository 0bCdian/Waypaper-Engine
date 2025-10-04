package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestConfigManagerCreation tests basic config manager creation and initialization
func TestConfigManagerCreation(t *testing.T) {
	tests := []struct {
		name        string
		configPath  string
		expectError bool
	}{
		{
			name:        "Absolute path",
			configPath:  "/tmp/test-config.toml",
			expectError: false,
		},
		{
			name:        "Relative path",
			configPath:  "./test-config.toml",
			expectError: false,
		},
		{
			name:        "Nested path creation",
			configPath:  "/tmp/nested/directory/config.toml",
			expectError: false,
		},
		{
			name:        "Empty path",
			configPath:  "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				// Cleanup: remove any created files
				os.Remove(tt.configPath)
				os.RemoveAll(filepath.Dir(tt.configPath))
			}()

			configManager := NewConfigManager(tt.configPath)

			if tt.expectError {
				// For this test, we expect NewConfigManager to succeed even with invalid paths
				// The error should come from LoadConfig, not from NewConfigManager
				t.Error("This test case needs to be restructured - NewConfigManager doesn't return errors")
				return
			}

			if configManager == nil {
				t.Fatalf("Unexpected error creating config manager")
			}

			if configManager == nil {
				t.Fatal("Expected config manager but got nil")
			}

			// Test that directory gets created
			if tt.configPath != "" && tt.configPath != "./test-config.toml" {
				dir := filepath.Dir(tt.configPath)
				if _, err := os.Stat(dir); os.IsNotExist(err) {
					t.Errorf("Expected directory %s to be created", dir)
				}
			}
		})
	}
}

// TestLoadConfigFromExistingFile tests loading from an existing file
func TestLoadConfigFromExistingFile(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "test-config.toml")

	configContent := `
[app]
kill_daemon_on_exit = false
notifications = false
images_per_page = 25
theme = "auto"
image_history_limit = 75

[daemon]
database_path = "~/.config/waypaper-engine/test.db"
images_dir = "~/TestImages"
thumbnails_dir = "~/.cache/test-thumbnails"
socket_path = "/tmp/test-waypaper.sock"
log_level = "debug"

[backend]
type = "nitrogen"

[backend.swww]
transition_type = "grow"
transition_duration = 300
transition_step = 45
transition_angle = 90
transition_pos = "top"
transition_bezier = "0.25,0.46,0.45,0.94"
transition_wave = "1,1,1,1"

[backend.feh]
scale = "--bg-center"
bg = "#ffffff"
center = true

[backend.nitrogen]
display_format = "x11"
bg_color = "#2d3748"

[monitors]
selected_monitors = ["DP-1"]
image_set_type = "clone"
`

	err := os.WriteFile(configPath, []byte(configContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	configManager := NewConfigManager(configPath)
	config, err := configManager.LoadConfig()

	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Verify app settings
	if config.App.KillDaemonOnExit != false {
		t.Errorf("Expected KillDaemonOnExit false, got %v", config.App.KillDaemonOnExit)
	}
	if config.App.Notifications != false {
		t.Errorf("Expected Notifications false, got %v", config.App.Notifications)
	}
	if config.App.ImagesPerPage != 25 {
		t.Errorf("Expected ImagesPerPage 25, got %d", config.App.ImagesPerPage)
	}
	if config.App.Theme != "auto" {
		t.Errorf("Expected Theme 'auto', got %s", config.App.Theme)
	}
	if config.App.ImageHistoryLimit != 75 {
		t.Errorf("Expected ImageHistoryLimit 75, got %d", config.App.ImageHistoryLimit)
	}

	// Verify daemon settings
	if config.Daemon.DatabasePath != "~/.config/waypaper-engine/test.db" {
		t.Errorf("Expected DatabasePath '~/.config/waypaper-engine/test.db', got %s", config.Daemon.DatabasePath)
	}
	if config.Daemon.ImagesDir != "~/TestImages" {
		t.Errorf("Expected ImagesDir '~/TestImages', got %s", config.Daemon.ImagesDir)
	}
	if config.Daemon.ThumbnailsDir != "~/.cache/test-thumbnails" {
		t.Errorf("Expected ThumbnailsDir '~/.cache/test-thumbnails', got %s", config.Daemon.ThumbnailsDir)
	}
	if config.Daemon.SocketPath != "/tmp/test-waypaper.sock" {
		t.Errorf("Expected SocketPath '/tmp/test-waypaper.sock', got %s", config.Daemon.SocketPath)
	}
	if config.Daemon.LogLevel != "debug" {
		t.Errorf("Expected LogLevel 'debug', got %s", config.Daemon.LogLevel)
	}

	// Verify backend settings
	if config.Backend.Type != "nitrogen" {
		t.Errorf("Expected Backend.Type 'nitrogen', got %s", config.Backend.Type)
	}

	// Verify SWW settings (should still be parsed even if not active backend)
	if config.Backend.Swww.TransitionType != "grow" {
		t.Errorf("Expected TransitionType 'grow', got %s", config.Backend.Swww.TransitionType)
	}
	if config.Backend.Swww.TransitionDuration != 300 {
		t.Errorf("Expected TransitionDuration 300, got %d", config.Backend.Swww.TransitionDuration)
	}
	if config.Backend.Swww.TransitionStep != 45 {
		t.Errorf("Expected TransitionStep 45, got %d", config.Backend.Swww.TransitionStep)
	}
	if config.Backend.Swww.TransitionAngle != 90 {
		t.Errorf("Expected TransitionAngle 90, got %d", config.Backend.Swww.TransitionAngle)
	}
	if config.Backend.Swww.TransitionPos != "top" {
		t.Errorf("Expected TransitionPos 'top', got %s", config.Backend.Swww.TransitionPos)
	}
	if config.Backend.Swww.TransitionBezier != "0.25,0.46,0.45,0.94" {
		t.Errorf("Expected TransitionBezier '0.25,0.46,0.45,0.94', got %s", config.Backend.Swww.TransitionBezier)
	}
	if config.Backend.Swww.TransitionWave != "1,1,1,1" {
		t.Errorf("Expected TransitionWave '1,1,1,1', got %s", config.Backend.Swww.TransitionWave)
	}

	// Verify monitor settings
	if len(config.Monitors.SelectedMonitors) != 1 || config.Monitors.SelectedMonitors[0] != "DP-1" {
		t.Errorf("Expected SelectedMonitors ['DP-1'], got %v", config.Monitors.SelectedMonitors)
	}
	if config.Monitors.ImageSetType != "clone" {
		t.Errorf("Expected ImageSetType 'clone', got %s", config.Monitors.ImageSetType)
	}
}

// TestLoadSaveLoadCycle tests the complete load-save-load cycle
func TestLoadSaveLoadCycle(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "cycle-test.toml")

	// Initial configuration
	initialConfig := `
[app]
kill_daemon_on_exit = true
notifications = true
images_per_page = 20
theme = "dark"

[daemon]
database_path = "~/.config/waypaper-engine/initial.db"
socket_path = "/tmp/initial.sock"
log_level = "info"

[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_duration = 200
`

	err := os.WriteFile(configPath, []byte(initialConfig), 0644)
	if err != nil {
		t.Fatalf("Failed to write initial config: %v", err)
	}

	configManager := NewConfigManager(configPath)

	// Load initial config
	config1, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load initial config: %v", err)
	}

	// Modify config
	config1.App.Theme = "light"
	config1.App.ImageHistoryLimit = 100
	config1.Daemon.LogLevel = "debug"
	config1.Backend.Type = "feh"
	config1.Backend.Swww.TransitionDuration = 1000

	// Save modified config
	err = configManager.SaveConfig()
	if err != nil {
		t.Fatalf("Failed to save config: %v", err)
	}

	// Reload config
	config2, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to reload config: %v", err)
	}

	// Verify changes were persisted
	if config2.App.Theme != "light" {
		t.Errorf("Expected Theme 'light' to be persisted, got %s", config2.App.Theme)
	}
	if config2.App.ImageHistoryLimit != 100 {
		t.Errorf("Expected ImageHistoryLimit 100 to be persisted, got %d", config2.App.ImageHistoryLimit)
	}
	if config2.Daemon.LogLevel != "debug" {
		t.Errorf("Expected LogLevel 'debug' to be persisted, got %s", config2.Daemon.LogLevel)
	}
	if config2.Backend.Type != "feh" {
		t.Errorf("Expected Backend.Type 'feh' to be persisted, got %s", config2.Backend.Type)
	}
	if config2.Backend.Swww.TransitionDuration != 1000 {
		t.Errorf("Expected TransitionDuration 1000 to be persisted, got %d", config2.Backend.Swww.TransitionDuration)
	}

	// Verify unchanged values
	if config2.App.KillDaemonOnExit != true {
		t.Errorf("Expected KillDaemonOnExit to remain true, got %v", config2.App.KillDaemonOnExit)
	}
	if config2.App.Notifications != true {
		t.Errorf("Expected Notifications to remain true, got %v", config2.App.Notifications)
	}
	if config2.App.ImagesPerPage != 20 {
		t.Errorf("Expected ImagesPerPage to remain 20, got %d", config2.App.ImagesPerPage)
	}
	if config2.Daemon.DatabasePath != "~/.config/waypaper-engine/initial.db" {
		t.Errorf("Expected DatabasePath to remain unchanged, got %s", config2.Daemon.DatabasePath)
	}
}

// TestDefaultConfiguration tests default configuration values
func TestDefaultConfiguration(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "defaults-test.toml")

	configManager := NewConfigManager(configPath)

	// Load config (should create defaults)
	config, err := configManager.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load default config: %v", err)
	}

	// Verify app defaults
	if config.App.KillDaemonOnExit != false {
		t.Errorf("Expected default KillDaemonOnExit false, got %v", config.App.KillDaemonOnExit)
	}
	if config.App.Notifications != true {
		t.Errorf("Expected default Notifications true, got %v", config.App.Notifications)
	}
	if config.App.StartMinimized != false {
		t.Errorf("Expected default StartMinimized false, got %v", config.App.StartMinimized)
	}
	if config.App.MinimizeInsteadOfClose != true {
		t.Errorf("Expected default MinimizeInsteadOfClose true, got %v", config.App.MinimizeInsteadOfClose)
	}
	if config.App.RandomImageMonitor != "individual" {
		t.Errorf("Expected default RandomImageMonitor 'individual', got %s", config.App.RandomImageMonitor)
	}
	if config.App.ShowMonitorModalOnStart != false {
		t.Errorf("Expected default ShowMonitorModalOnStart false, got %v", config.App.ShowMonitorModalOnStart)
	}
	if config.App.ImagesPerPage != 20 {
		t.Errorf("Expected default ImagesPerPage 20, got %d", config.App.ImagesPerPage)
	}
	if config.App.Theme != "dark" {
		t.Errorf("Expected default Theme 'dark', got %s", config.App.Theme)
	}
	if config.App.SidebarCollapsed != false {
		t.Errorf("Expected default SidebarCollapsed false, got %v", config.App.SidebarCollapsed)
	}
	if config.App.SortBy != "name" {
		t.Errorf("Expected default SortBy 'name', got %s", config.App.SortBy)
	}
	if config.App.SortOrder != "asc" {
		t.Errorf("Expected default SortOrder 'asc', got %s", config.App.SortOrder)
	}
	if config.App.ImageHistoryLimit != 50 {
		t.Errorf("Expected default ImageHistoryLimit 50, got %d", config.App.ImageHistoryLimit)
	}

	// Verify daemon defaults
	if config.Daemon.DatabasePath != "~/.config/waypaper-engine/waypaper.db" {
		t.Errorf("Expected default DatabasePath '~/.config/waypaper-engine/waypaper.db', got %s", config.Daemon.DatabasePath)
	}
	if config.Daemon.ImagesDir != "~/.waypaper-engine/images" {
		t.Errorf("Expected default ImagesDir '~/.waypaper-engine/images', got %s", config.Daemon.ImagesDir)
	}
	if config.Daemon.ThumbnailsDir != "~/.cache/waypaper-engine/thumbnails" {
		t.Errorf("Expected default ThumbnailsDir '~/.cache/waypaper-engine/thumbnails', got %s", config.Daemon.ThumbnailsDir)
	}
	if config.Daemon.MonitorsStateFile != "~/.cache/waypaper-engine/monitors.json" {
		t.Errorf("Expected default MonitorsStateFile '~/.cache/waypaper-engine/monitors.json', got %s", config.Daemon.MonitorsStateFile)
	}
	if config.Daemon.SocketPath != "/tmp/waypaper-engine.sock" {
		t.Errorf("Expected default SocketPath '/tmp/waypaper-engine.sock', got %s", config.Daemon.SocketPath)
	}
	if config.Daemon.LogLevel != "info" {
		t.Errorf("Expected default LogLevel 'info', got %s", config.Daemon.LogLevel)
	}

	// Verify backend defaults
	if config.Backend.Type != "swww" {
		t.Errorf("Expected default Backend.Type 'swww', got %s", config.Backend.Type)
	}

	// Verify monitor defaults
	if len(config.Monitors.SelectedMonitors) != 0 {
		t.Errorf("Expected default SelectedMonitors [], got %v", config.Monitors.SelectedMonitors)
	}
	if config.Monitors.ImageSetType != "individual" {
		t.Errorf("Expected default ImageSetType 'individual', got %s", config.Monitors.ImageSetType)
	}
}

// TestInvalidTOMLErrorHandling tests error handling for invalid TOML
func TestInvalidTOMLErrorHandling(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "invalid-test.toml")

	tests := []struct {
		name        string
		tomlContent string
		expectError bool
	}{
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
		{
			name: "Invalid data type",
			tomlContent: `
[app]
kill_daemon_on_exit = "not-a-bool"
notifications = true
images_per_page = 20
`,
			expectError: true,
		},
		{
			name: "Invalid enum value",
			tomlContent: `
[app]
theme = "invalid-theme"
notifications = true
images_per_page = 20
`,
			expectError: false, // Should default to valid value
		},
		{
			name: "Unknown section",
			tomlContent: `
[app]
notifications = true
images_per_page = 20

[unknown_section]
some_setting = "value"
`,
			expectError: false, // Unknown sections should be ignored
		},
		{
			name: "Unknown field",
			tomlContent: `
[app]
notifications = true
images_per_page = 20
unknown_field = "should be ignored"
`,
			expectError: false, // Unknown fields should be ignored
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := os.WriteFile(configPath, []byte(tt.tomlContent), 0644)
			if err != nil {
				t.Fatalf("Failed to write config file: %v", err)
			}

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

			if config == nil {
				t.Fatal("Expected config but got nil")
			}
		})
	}
}

// TestConfigValidation tests config validation logic
func TestConfigValidation(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "validation-test.toml")

	tests := []struct {
		name        string
		config      func(*WaypaperConfig)
		expectError bool
	}{
		{
			name:        "Valid log level",
			config:      func(c *WaypaperConfig) { c.Daemon.LogLevel = "debug" },
			expectError: false,
		},
		{
			name:        "Invalid log level",
			config:      func(c *WaypaperConfig) { c.Daemon.LogLevel = "invalid-level" },
			expectError: true,
		},
		{
			name:        "Valid backend type",
			config:      func(c *WaypaperConfig) { c.Backend.Type = "feh" },
			expectError: false,
		},
		{
			name:        "Invalid backend type",
			config:      func(c *WaypaperConfig) { c.Backend.Type = "invalid-backend" },
			expectError: true,
		},
		{
			name:        "Valid transition type",
			config:      func(c *WaypaperConfig) { c.Backend.Swww.TransitionType = "wave" },
			expectError: false,
		},
		{
			name:        "Invalid transition type",
			config:      func(c *WaypaperConfig) { c.Backend.Swww.TransitionType = "invalid-transition" },
			expectError: true,
		},
		{
			name:        "Negative transition duration",
			config:      func(c *WaypaperConfig) { c.Backend.Swww.TransitionDuration = -100 },
			expectError: true,
		},
		{
			name:        "Zero transition duration",
			config:      func(c *WaypaperConfig) { c.Backend.Swww.TransitionDuration = 0 },
			expectError: false,
		},
		{
			name:        "Large transition duration",
			config:      func(c *WaypaperConfig) { c.Backend.Swww.TransitionDuration = 30000 },
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configManager := NewConfigManager(configPath)

			// Load default config
			config, err := configManager.LoadConfig()
			if err != nil {
				t.Fatalf("Failed to load default config: %v", err)
			}

			// Apply test-specific modifications
			if tt.config != nil {
				tt.config(config)
			}

			// Save and reload to trigger validation
			err = configManager.SaveConfig()

			if tt.expectError {
				if err == nil {
					t.Error("Expected validation error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected validation error: %v", err)
			}

			// Config should save successfully
			if err := configManager.SaveConfig(); err != nil {
				t.Fatalf("Failed to save config after validation: %v", err)
			}
		})
	}
}
