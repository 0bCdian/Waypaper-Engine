package store

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// PlaylistAnalytics tracks usage statistics for playlists
type PlaylistAnalytics struct {
	mu       sync.RWMutex
	data     *AnalyticsData
	filePath string
	logger   *slog.Logger
}

// AnalyticsData represents the analytics data structure
type AnalyticsData struct {
	Version       string                   `json:"version"`
	LastUpdated   string                   `json:"last_updated"`
	PlaylistStats map[string]*PlaylistStat `json:"playlist_stats"`
	GlobalStats   *GlobalStats             `json:"global_stats"`
}

// PlaylistStat tracks statistics for a single playlist
type PlaylistStat struct {
	PlaylistName    string    `json:"playlist_name"`
	PlaylistType    string    `json:"playlist_type"`
	TotalSessions   int64     `json:"total_sessions"`
	TotalPlayTime   int64     `json:"total_play_time_seconds"`
	ImageChanges    int64     `json:"image_changes"`
	LastPlayed      time.Time `json:"last_played"`
	FirstPlayed     time.Time `json:"first_played"`
	AverageSession  float64   `json:"average_session_seconds"`
	PauseCount      int64     `json:"pause_count"`
	ResumeCount     int64     `json:"resume_count"`
	StopCount       int64     `json:"stop_count"`
	ManualSkipCount int64     `json:"manual_skip_count"`
	ErrorCount      int64     `json:"error_count"`
}

// GlobalStats tracks global application statistics
type GlobalStats struct {
	TotalPlaylistsCreated int64            `json:"total_playlists_created"`
	TotalSessions         int64            `json:"total_sessions"`
	TotalPlayTime         int64            `json:"total_play_time_seconds"`
	TotalImageChanges     int64            `json:"total_image_changes"`
	MostUsedPlaylist      string           `json:"most_used_playlist"`
	MostUsedType          string           `json:"most_used_type"`
	LastSessionDate       time.Time        `json:"last_session_date"`
	AverageSessionLength  float64          `json:"average_session_length_seconds"`
	TotalErrors           int64            `json:"total_errors"`
	SessionsByType        map[string]int64 `json:"sessions_by_type"`
}

// EventType represents different types of playlist events
type EventType string

const (
	EventPlaylistStarted EventType = "playlist_started"
	EventPlaylistStopped EventType = "playlist_stopped"
	EventPlaylistPaused  EventType = "playlist_paused"
	EventPlaylistResumed EventType = "playlist_resumed"
	EventImageChanged    EventType = "image_changed"
	EventManualSkip      EventType = "manual_skip"
	EventError           EventType = "error"
)

// AnalyticsEvent represents an analytics event
type AnalyticsEvent struct {
	EventType    EventType              `json:"event_type"`
	Timestamp    time.Time              `json:"timestamp"`
	PlaylistName string                 `json:"playlist_name"`
	PlaylistType string                 `json:"playlist_type"`
	Duration     int64                  `json:"duration_seconds,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// NewPlaylistAnalytics creates a new playlist analytics tracker
func NewPlaylistAnalytics(dataDir string, logger *slog.Logger) *PlaylistAnalytics {
	return &PlaylistAnalytics{
		data: &AnalyticsData{
			Version:       "1.0",
			LastUpdated:   time.Now().Format(time.RFC3339),
			PlaylistStats: make(map[string]*PlaylistStat),
			GlobalStats: &GlobalStats{
				SessionsByType: make(map[string]int64),
			},
		},
		filePath: filepath.Join(dataDir, "playlist_analytics.json"),
		logger:   logger,
	}
}

// RecordEvent records a playlist analytics event
func (pa *PlaylistAnalytics) RecordEvent(event *AnalyticsEvent) {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	now := time.Now()
	event.Timestamp = now

	// Update global stats
	pa.data.GlobalStats.LastSessionDate = now
	if event.EventType == EventPlaylistStarted {
		pa.data.GlobalStats.TotalSessions++
		pa.data.GlobalStats.SessionsByType[event.PlaylistType]++
	}

	// Update playlist-specific stats
	stat, exists := pa.data.PlaylistStats[event.PlaylistName]
	if !exists {
		stat = &PlaylistStat{
			PlaylistName: event.PlaylistName,
			PlaylistType: event.PlaylistType,
			FirstPlayed:  now,
			LastPlayed:   now,
		}
		pa.data.PlaylistStats[event.PlaylistName] = stat
		pa.data.GlobalStats.TotalPlaylistsCreated++
	}

	// Update stats based on event type
	switch event.EventType {
	case EventPlaylistStarted:
		stat.TotalSessions++
		stat.LastPlayed = now
		if timeAgo, ok := event.Metadata["time_since_last_stop"].(int64); ok {
			stat.TotalPlayTime += timeAgo
			pa.data.GlobalStats.TotalPlayTime += timeAgo
		}

	case EventPlaylistStopped:
		if duration, ok := event.Metadata["session_duration"].(int64); ok {
			stat.TotalPlayTime += duration
			pa.data.GlobalStats.TotalPlayTime += duration
			stat.AverageSession = float64(stat.TotalPlayTime) / float64(stat.TotalSessions)
		}
		stat.StopCount++

	case EventPlaylistPaused:
		stat.PauseCount++

	case EventPlaylistResumed:
		stat.ResumeCount++
		if duration, ok := event.Metadata["pause_duration"].(int64); ok {
			stat.TotalPlayTime += duration
			pa.data.GlobalStats.TotalPlayTime += duration
		}

	case EventImageChanged:
		stat.ImageChanges++
		pa.data.GlobalStats.TotalImageChanges++

	case EventManualSkip:
		stat.ManualSkipCount++

	case EventError:
		stat.ErrorCount++
		pa.data.GlobalStats.TotalErrors++
	}

	// Update global averages and most used
	pa.updateGlobalStats()

	pa.logger.Debug("analytics event recorded",
		"event_type", event.EventType,
		"playlist", event.PlaylistName,
		"type", event.PlaylistType)
}

// updateGlobalStats updates global statistics
func (pa *PlaylistAnalytics) updateGlobalStats() {
	pa.data.GlobalStats.AverageSessionLength = 0
	if pa.data.GlobalStats.TotalSessions > 0 {
		pa.data.GlobalStats.AverageSessionLength = float64(pa.data.GlobalStats.TotalPlayTime) / float64(pa.data.GlobalStats.TotalSessions)
	}

	// Find most used playlist and type
	maxSessions := int64(0)
	maxTypeSessions := int64(0)

	for _, stat := range pa.data.PlaylistStats {
		if stat.TotalSessions > maxSessions {
			maxSessions = stat.TotalSessions
			pa.data.GlobalStats.MostUsedPlaylist = stat.PlaylistName
		}
	}

	for playlistType, count := range pa.data.GlobalStats.SessionsByType {
		if count > maxTypeSessions {
			maxTypeSessions = count
			pa.data.GlobalStats.MostUsedType = playlistType
		}
	}
}

// SaveAnalytics saves analytics data to disk
func (pa *PlaylistAnalytics) SaveAnalytics() error {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	pa.data.LastUpdated = time.Now().Format(time.RFC3339)

	data, err := json.MarshalIndent(pa.data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal analytics data: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(pa.filePath), 0755); err != nil {
		return fmt.Errorf("failed to create analytics directory: %w", err)
	}

	if err := os.WriteFile(pa.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write analytics data: %w", err)
	}

	pa.logger.Info("analytics saved")

	return nil
}

// LoadAnalytics loads analytics data from disk
func (pa *PlaylistAnalytics) LoadAnalytics() error {
	data, err := os.ReadFile(pa.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			pa.logger.Info("no analytics file found, starting fresh")
			return nil
		}
		return fmt.Errorf("failed to read analytics file: %w", err)
	}

	pa.mu.Lock()
	defer pa.mu.Unlock()

	if err := json.Unmarshal(data, pa.data); err != nil {
		return fmt.Errorf("failed to unmarshal analytics data: %w", err)
	}

	pa.logger.Info("analytics loaded",
		"version", pa.data.Version,
		"playlists", len(pa.data.PlaylistStats),
		"total_sessions", pa.data.GlobalStats.TotalSessions)

	return nil
}

// GetPlaylistStats returns statistics for a specific playlist
func (pa *PlaylistAnalytics) GetPlaylistStats(playlistName string) *PlaylistStat {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	if stat, exists := pa.data.PlaylistStats[playlistName]; exists {
		return stat
	}
	return nil
}

// GetAllStats returns all analytics data
func (pa *PlaylistAnalytics) GetAllStats() *AnalyticsData {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	return pa.data
}

// GetTopPlaylists returns the top N most used playlists
func (pa *PlaylistAnalytics) GetTopPlaylists(limit int) []*PlaylistStat {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	var stats []*PlaylistStat
	for _, stat := range pa.data.PlaylistStats {
		stats = append(stats, stat)
	}

	// Sort by total sessions (descending)
	for i := 0; i < len(stats)-1; i++ {
		for j := i + 1; j < len(stats); j++ {
			if stats[i].TotalSessions < stats[j].TotalSessions {
				stats[i], stats[j] = stats[j], stats[i]
			}
		}
	}

	if limit > len(stats) {
		limit = len(stats)
	}

	return stats[:limit]
}

// GetStatsSummary returns a summary of analytics
func (pa *PlaylistAnalytics) GetStatsSummary() map[string]interface{} {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	return map[string]interface{}{
		"total_playlists":       len(pa.data.PlaylistStats),
		"total_sessions":        pa.data.GlobalStats.TotalSessions,
		"total_playtime_hours":  float64(pa.data.GlobalStats.TotalPlayTime) / 3600,
		"total_image_changes":   pa.data.GlobalStats.TotalImageChanges,
		"most_used_playlist":    pa.data.GlobalStats.MostUsedPlaylist,
		"most_used_type":        pa.data.GlobalStats.MostUsedType,
		"average_session_hours": pa.data.GlobalStats.AverageSessionLength / 3600,
		"total_errors":          pa.data.GlobalStats.TotalErrors,
		"last_updated":          pa.data.LastUpdated,
	}
}

// ResetAnalytics clears all analytics data
func (pa *PlaylistAnalytics) ResetAnalytics() error {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	pa.data = &AnalyticsData{
		Version:       "1.0",
		LastUpdated:   time.Now().Format(time.RFC3339),
		PlaylistStats: make(map[string]*PlaylistStat),
		GlobalStats: &GlobalStats{
			SessionsByType: make(map[string]int64),
		},
	}

	pa.logger.Info("analytics data reset")
	return pa.SaveAnalytics()
}
