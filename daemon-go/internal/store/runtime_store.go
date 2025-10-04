package store

import (
	"fmt"
	"strings"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// RuntimeStore handles runtime state storage operations
type RuntimeStore struct {
	store *Store
}

// NewRuntimeStore creates a new runtime store
func NewRuntimeStore(store *Store) *RuntimeStore {
	return &RuntimeStore{
		store: store,
	}
}

// LoadRuntimeState loads the current runtime state
func (rs *RuntimeStore) LoadRuntimeState() (*RuntimeState, error) {
	cacheKey := "runtime_state"
	filePath := rs.store.getFilePath("runtime.json")

	var state RuntimeState
	if err := rs.store.cachedLoad(cacheKey, filePath, &state); err != nil {
		// If file doesn't exist, return default state
		if containsString(err.Error(), "not found") {
			return rs.getDefaultRuntimeState(), nil
		}
		return nil, fmt.Errorf("failed to load runtime state: %w", err)
	}

	return &state, nil
}

// SaveRuntimeState saves the runtime state
func (rs *RuntimeStore) SaveRuntimeState(state *RuntimeState) error {
	state.Metadata.LastSave = time.Now()

	filePath := rs.store.getFilePath("runtime.json")
	return rs.store.saveJSON(filePath, state)
}

// UpdateRuntimeState atomically updates runtime state
func (rs *RuntimeStore) UpdateRuntimeState(updates func(*RuntimeState)) error {
	state, err := rs.LoadRuntimeState()
	if err != nil {
		return err
	}

	updates(state)
	return rs.SaveRuntimeState(state)
}

// SetActivePlaylist sets an active playlist for a monitor
func (rs *RuntimeStore) SetActivePlaylist(monitorName string, playlistID, playlistName string) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.ActivePlaylists == nil {
			state.ActivePlaylists = make(map[string]*ActivePlaylistState)
		}

		state.ActivePlaylists[monitorName] = &ActivePlaylistState{
			PlaylistID:   playlistID,
			PlaylistName: playlistName,
			StartedAt:    time.Now(),
			Status:       "active",
		}
	})
}

// StopActivePlaylist stops an active playlist for a monitor
func (rs *RuntimeStore) StopActivePlaylist(monitorName string) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.ActivePlaylists != nil {
			if activePlaylist, exists := state.ActivePlaylists[monitorName]; exists {
				activePlaylist.Status = "stopped"
				activePlaylist.LastActivity = time.Now()
			}
		}
	})
}

// UpdateActivePlaylistStatus updates the status of an active playlist
func (rs *RuntimeStore) UpdateActivePlaylistStatus(monitorName string, status string) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.ActivePlaylists != nil {
			if activePlaylist, exists := state.ActivePlaylists[monitorName]; exists {
				activePlaylist.Status = status

				now := time.Now()
				switch status {
				case "paused":
					activePlaylist.PausedAt = &now
				case "active":
					activePlaylist.PausedAt = nil
				case "stopped":
					activePlaylist.LastActivity = now
				}
			}
		}
	})
}

// SetCurrentWallpaper updates the current wallpaper for a monitor
func (rs *RuntimeStore) SetCurrentWallpaper(monitorName string, wallpaper *CurrentWallpaper) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.MonitorState.Monitors == nil {
			state.MonitorState.Monitors = []MonitorInfo{}
		}

		// Find and update monitor
		for i := range state.MonitorState.Monitors {
			if state.MonitorState.Monitors[i].Name == monitorName {
				state.MonitorState.Monitors[i].CurrentWallpaper = wallpaper
				return
			}
		}

		// If monitor not found, create a basic entry
		state.MonitorState.Monitors = append(state.MonitorState.Monitors, MonitorInfo{
			Name:             monitorName,
			CurrentWallpaper: wallpaper,
		})
	})
}

// SetSelectedMonitor sets the currently selected monitor
func (rs *RuntimeStore) SetSelectedMonitor(monitorName string) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		state.SelectedMonitor = monitorName

		// Update monitor properties
		if state.MonitorState.Monitors != nil {
			for i := range state.MonitorState.Monitors {
				state.MonitorState.Monitors[i].Properties.IsSelected = state.MonitorState.Monitors[i].Name == monitorName
			}
		}
	})
}

// UpdateMonitorInfo updates monitor information
func (rs *RuntimeStore) UpdateMonitorInfo(monitor MonitorInfo) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.MonitorState.Monitors == nil {
			state.MonitorState.Monitors = []MonitorInfo{}
		}

		// Update or add monitor
		for i := range state.MonitorState.Monitors {
			if state.MonitorState.Monitors[i].Name == monitor.Name {
				state.MonitorState.Monitors[i] = monitor
				return
			}
		}

		// Add new monitor
		state.MonitorState.Monitors = append(state.MonitorState.Monitors, monitor)
		state.MonitorState.ActiveCount++
		state.MonitorState.LastDetection = time.Now()
	})
}

// UpdateGlobalSettings updates global settings
func (rs *RuntimeStore) UpdateGlobalSettings(settings GlobalSettings) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		state.GlobalSettings = settings
	})
}

// UpdateStatistics updates runtime statistics
func (rs *RuntimeStore) UpdateStatistics(updates func(*RuntimeStatistics)) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if updates != nil {
			updates(&state.Statistics)
			state.Statistics.LastStatisticsUpdate = time.Now()
		}
	})
}

// IncrementImageSetCount increments the image set counter
func (rs *RuntimeStore) IncrementImageSetCount() error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		state.Statistics.TotalImagesSet++
	})
}

// UpdateUptime updates the uptime counter
func (rs *RuntimeStore) UpdateUptime(uptimeSeconds int64) error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		state.Metadata.Uptime = &uptimeSeconds
		state.Statistics.TotalUptime = uptimeSeconds
	})
}

// RecordCrash records a crash event
func (rs *RuntimeStore) RecordCrash() error {
	return rs.UpdateRuntimeState(func(state *RuntimeState) {
		if state.Metadata.CrashCount == nil {
			state.Metadata.CrashCount = new(int)
		}
		*state.Metadata.CrashCount++

		now := time.Now()
		state.Metadata.LastCrash = &now
	})
}

// GetActivePlaylists returns all active playlists
func (rs *RuntimeStore) GetActivePlaylists() (map[string]*ActivePlaylistState, error) {
	state, err := rs.LoadRuntimeState()
	if err != nil {
		return nil, err
	}

	if state.ActivePlaylists == nil {
		return make(map[string]*ActivePlaylistState), nil
	}

	return state.ActivePlaylists, nil
}

// GetMonitorInfo returns monitor information
func (rs *RuntimeStore) GetMonitorInfo(monitorName string) (*MonitorInfo, error) {
	state, err := rs.LoadRuntimeState()
	if err != nil {
		return nil, err
	}

	for _, monitor := range state.MonitorState.Monitors {
		if monitor.Name == monitorName {
			return &monitor, nil
		}
	}

	return nil, fmt.Errorf("monitor not found: %s", monitorName)
}

// GetAllMonitors returns all monitors
func (rs *RuntimeStore) GetAllMonitors() ([]MonitorInfo, error) {
	state, err := rs.LoadRuntimeState()
	if err != nil {
		return nil, err
	}

	return state.MonitorState.Monitors, nil
}

// Helper functions

// getDefaultRuntimeState returns a default runtime state
func (rs *RuntimeStore) getDefaultRuntimeState() *RuntimeState {
	now := time.Now()
	return &RuntimeState{
		Metadata: RuntimeMetadata{
			Version:       "1.0",
			LastSave:      now,
			DaemonVersion: "0.0.0",
		},
		ActivePlaylists: make(map[string]*ActivePlaylistState),
		MonitorState: MonitorStateRegistry{
			Monitors:      []MonitorInfo{},
			LastDetection: now,
			ActiveCount:   0,
		},
		SelectedMonitor: "",
		GlobalSettings: GlobalSettings{
			AutoStart:         true,
			ImageHistoryLimit: 50,
			EnableTransitions: func() *bool { b := true; return &b }(),
		},
		Statistics: RuntimeStatistics{
			LastStatisticsUpdate: now,
		},
	}
}

// NewActivePlaylistState creates a new active playlist state
func NewActivePlaylistState(playlistID, playlistName string) *ActivePlaylistState {
	return &ActivePlaylistState{
		PlaylistID:   playlistID,
		PlaylistName: playlistName,
		StartedAt:    time.Now(),
		Status:       "active",
	}
}

// NewCurrentWallpaper creates a new current wallpaper entry
func NewCurrentWallpaper(imageID, imagePath string, mediaType media.MediaType, backendUsed string) *CurrentWallpaper {
	return &CurrentWallpaper{
		ImageID:     imageID,
		ImagePath:   imagePath,
		MediaType:   mediaType,
		SetAt:       time.Now(),
		BackendUsed: backendUsed,
	}
}

// containsString checks if a string contains a substring
func containsString(s, substr string) bool {
	return strings.Contains(s, substr)
}
