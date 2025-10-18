package ipc

import (
	"testing"
	"waypaper-engine/daemon-go/internal/models"
)

func TestMessageValidator_ValidatePingMessage(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		message *Message
		wantErr bool
	}{
		{
			name: "valid ping message",
			message: &Message{
				Action:    "ping",
				MessageID: 1,
			},
			wantErr: false,
		},
		{
			name: "ping message with negative message ID",
			message: &Message{
				Action:    "ping",
				MessageID: -1,
			},
			wantErr: true,
		},
		{
			name: "ping message with zero message ID",
			message: &Message{
				Action:    "ping",
				MessageID: 0,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.validatePingMessage(tt.message)
			if (len(result.Errors) > 0) != tt.wantErr {
				t.Errorf("validatePingMessage() errors = %v, wantErr %v", result.Errors, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateStartPlaylistMessage(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		message *Message
		wantErr bool
	}{
		{
			name: "valid start playlist message",
			message: &Message{
				Action:     "start_playlist",
				PlaylistID: 1,
				ActiveMonitor: &models.ActiveMonitor{
					Name: "DP-1",
					Monitors: []models.Monitor{
						{
							Name:   "DP-1",
							Width:  1920,
							Height: 1080,
							Position: struct {
								X int `json:"x"`
								Y int `json:"y"`
							}{X: 0, Y: 0},
						},
					},
					ImageSetType: "individual",
				},
			},
			wantErr: false,
		},
		{
			name: "missing playlist ID",
			message: &Message{
				Action: "start_playlist",
				ActiveMonitor: &models.ActiveMonitor{
					Name: "DP-1",
					Monitors: []models.Monitor{
						{
							Name:   "DP-1",
							Width:  1920,
							Height: 1080,
							Position: struct {
								X int `json:"x"`
								Y int `json:"y"`
							}{X: 0, Y: 0},
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "missing active monitor",
			message: &Message{
				Action:     "start_playlist",
				PlaylistID: 1,
			},
			wantErr: true,
		},
		{
			name: "invalid playlist ID",
			message: &Message{
				Action:     "start_playlist",
				PlaylistID: 0,
				ActiveMonitor: &models.ActiveMonitor{
					Name: "DP-1",
					Monitors: []models.Monitor{
						{
							Name:   "DP-1",
							Width:  1920,
							Height: 1080,
							Position: struct {
								X int `json:"x"`
								Y int `json:"y"`
							}{X: 0, Y: 0},
						},
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.validateStartPlaylistMessage(tt.message)
			if (len(result.Errors) > 0) != tt.wantErr {
				t.Errorf("validateStartPlaylistMessage() errors = %v, wantErr %v", result.Errors, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateActiveMonitor(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name          string
		activeMonitor *models.ActiveMonitor
		wantErr       bool
	}{
		{
			name: "valid active monitor",
			activeMonitor: &models.ActiveMonitor{
				Name: "DP-1",
				Monitors: []models.Monitor{
					{
						Name:   "DP-1",
						Width:  1920,
						Height: 1080,
						Position: struct {
							X int `json:"x"`
							Y int `json:"y"`
						}{X: 0, Y: 0},
					},
				},
				ImageSetType: "individual",
			},
			wantErr: false,
		},
		{
			name:          "nil active monitor",
			activeMonitor: nil,
			wantErr:       true,
		},
		{
			name: "empty monitor name",
			activeMonitor: &models.ActiveMonitor{
				Name: "",
				Monitors: []models.Monitor{
					{
						Name:   "DP-1",
						Width:  1920,
						Height: 1080,
						Position: struct {
							X int `json:"x"`
							Y int `json:"y"`
						}{X: 0, Y: 0},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "no monitors",
			activeMonitor: &models.ActiveMonitor{
				Name:     "DP-1",
				Monitors: []models.Monitor{},
			},
			wantErr: true,
		},
		{
			name: "invalid monitor width",
			activeMonitor: &models.ActiveMonitor{
				Name: "DP-1",
				Monitors: []models.Monitor{
					{
						Name:   "DP-1",
						Width:  0,
						Height: 1080,
						Position: struct {
							X int `json:"x"`
							Y int `json:"y"`
						}{X: 0, Y: 0},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid monitor height",
			activeMonitor: &models.ActiveMonitor{
				Name: "DP-1",
				Monitors: []models.Monitor{
					{
						Name:   "DP-1",
						Width:  1920,
						Height: 0,
						Position: struct {
							X int `json:"x"`
							Y int `json:"y"`
						}{X: 0, Y: 0},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid image set type",
			activeMonitor: &models.ActiveMonitor{
				Name: "DP-1",
				Monitors: []models.Monitor{
					{
						Name:   "DP-1",
						Width:  1920,
						Height: 1080,
						Position: struct {
							X int `json:"x"`
							Y int `json:"y"`
						}{X: 0, Y: 0},
					},
				},
				ImageSetType: "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateActiveMonitor(tt.activeMonitor)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateActiveMonitor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateImageInfo(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		image   *ImageInfo
		wantErr bool
	}{
		{
			name: "valid image info",
			image: &ImageInfo{
				ID:   1,
				Name: "test.jpg",
			},
			wantErr: false,
		},
		{
			name:    "nil image",
			image:   nil,
			wantErr: true,
		},
		{
			name: "invalid image ID",
			image: &ImageInfo{
				ID:   0,
				Name: "test.jpg",
			},
			wantErr: true,
		},
		{
			name: "empty image name",
			image: &ImageInfo{
				ID:   1,
				Name: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateImageInfo(tt.image)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateImageInfo() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateRendererPlaylist(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name     string
		playlist *RendererPlaylist
		wantErr  bool
	}{
		{
			name: "valid playlist",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type:                    "timer",
					Interval:                int64Ptr(30),
					Order:                   stringPtr("ordered"),
					ShowAnimations:          true,
					AlwaysStartOnFirstImage: false,
					CurrentImageIndex:       0,
				},
			},
			wantErr: false,
		},
		{
			name:     "nil playlist",
			playlist: nil,
			wantErr:  true,
		},
		{
			name: "empty playlist name",
			playlist: &RendererPlaylist{
				Name: "",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type: "timer",
				},
			},
			wantErr: true,
		},
		{
			name: "no images",
			playlist: &RendererPlaylist{
				Name:   "Test Playlist",
				Images: []RendererImage{},
				Configuration: PlaylistConfiguration{
					Type: "timer",
				},
			},
			wantErr: true,
		},
		{
			name: "invalid image ID",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 0,
					},
				},
				Configuration: PlaylistConfiguration{
					Type: "timer",
				},
			},
			wantErr: true,
		},
		{
			name: "invalid playlist type",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type: "invalid",
				},
			},
			wantErr: true,
		},
		{
			name: "invalid interval for timer",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type:     "timer",
					Interval: int64Ptr(0),
				},
			},
			wantErr: true,
		},
		{
			name: "invalid order",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type:  "timer",
					Order: stringPtr("invalid"),
				},
			},
			wantErr: true,
		},
		{
			name: "negative current image index",
			playlist: &RendererPlaylist{
				Name: "Test Playlist",
				Images: []RendererImage{
					{
						ID: 1,
					},
				},
				Configuration: PlaylistConfiguration{
					Type:              "timer",
					CurrentImageIndex: -1,
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateRendererPlaylist(tt.playlist)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateRendererPlaylist() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateConfigData(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		config  *ConfigData
		wantErr bool
	}{
		{
			name: "valid config data with frontend config",
			config: &ConfigData{
				FrontendConfig: map[string]any{
					"app": map[string]any{
						"theme":           "dark",
						"images_per_page": 25,
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid config data with single key",
			config: &ConfigData{
				ConfigSection: "app",
				ConfigKey:     "theme",
				ConfigValue:   "dark",
			},
			wantErr: false,
		},
		{
			name:    "nil config",
			config:  nil,
			wantErr: true,
		},
		{
			name: "missing config section",
			config: &ConfigData{
				ConfigKey:   "theme",
				ConfigValue: "dark",
			},
			wantErr: true,
		},
		{
			name: "missing config key",
			config: &ConfigData{
				ConfigSection: "app",
				ConfigValue:   "dark",
			},
			wantErr: true,
		},
		{
			name: "invalid config section",
			config: &ConfigData{
				ConfigSection: "invalid",
				ConfigKey:     "theme",
				ConfigValue:   "dark",
			},
			wantErr: true,
		},
		{
			name: "invalid frontend config type",
			config: &ConfigData{
				FrontendConfig: "not a map",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateConfigData(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateConfigData() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateAppConfig(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		config  map[string]any
		wantErr bool
	}{
		{
			name: "valid app config",
			config: map[string]any{
				"theme":               "dark",
				"images_per_page":     25,
				"image_history_limit": 50,
			},
			wantErr: false,
		},
		{
			name: "invalid theme",
			config: map[string]any{
				"theme": "purple",
			},
			wantErr: true,
		},
		{
			name: "invalid images_per_page type",
			config: map[string]any{
				"images_per_page": "not a number",
			},
			wantErr: true,
		},
		{
			name: "invalid images_per_page value",
			config: map[string]any{
				"images_per_page": 0,
			},
			wantErr: true,
		},
		{
			name: "invalid image_history_limit type",
			config: map[string]any{
				"image_history_limit": "not a number",
			},
			wantErr: true,
		},
		{
			name: "invalid image_history_limit value",
			config: map[string]any{
				"image_history_limit": 0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateAppConfig(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAppConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateMonitorsConfig(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		config  map[string]any
		wantErr bool
	}{
		{
			name: "valid monitors config",
			config: map[string]any{
				"selected_monitors": []any{"DP-1", "HDMI-1"},
				"image_set_type":    "extend",
			},
			wantErr: false,
		},
		{
			name: "invalid selected_monitors type",
			config: map[string]any{
				"selected_monitors": "not an array",
			},
			wantErr: true,
		},
		{
			name: "empty monitor name",
			config: map[string]any{
				"selected_monitors": []any{"DP-1", ""},
			},
			wantErr: true,
		},
		{
			name: "invalid monitor name type",
			config: map[string]any{
				"selected_monitors": []any{"DP-1", 123},
			},
			wantErr: true,
		},
		{
			name: "invalid image_set_type",
			config: map[string]any{
				"image_set_type": "invalid",
			},
			wantErr: true,
		},
		{
			name: "invalid image_set_type type",
			config: map[string]any{
				"image_set_type": 123,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.validateMonitorsConfig(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateMonitorsConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMessageValidator_ValidateMessage(t *testing.T) {
	validator := NewMessageValidator(nil)

	tests := []struct {
		name    string
		message *Message
		wantErr bool
	}{
		{
			name:    "nil message",
			message: nil,
			wantErr: true,
		},
		{
			name: "empty action",
			message: &Message{
				Action: "",
			},
			wantErr: true,
		},
		{
			name: "unknown action",
			message: &Message{
				Action: "unknown_action",
			},
			wantErr: true,
		},
		{
			name: "valid ping message",
			message: &Message{
				Action:    "ping",
				MessageID: 1,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.ValidateMessage(tt.message)
			if (len(result.Errors) > 0) != tt.wantErr {
				t.Errorf("ValidateMessage() errors = %v, wantErr %v", result.Errors, tt.wantErr)
			}
		})
	}
}

// Helper functions for tests
func int64Ptr(i int64) *int64 {
	return &i
}

func stringPtr(s string) *string {
	return &s
}
