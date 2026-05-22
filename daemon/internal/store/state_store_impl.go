package store

import (
	"slices"
	"sync"
)

// stateStore is the in-memory implementation of StateStore.
// State is NOT persisted — it is lost on daemon restart.
type stateStore struct {
	mu               sync.RWMutex
	activePlaylists  map[int]ActivePlaylistInstance
	currentWallpaper map[string]ImageHistoryEntry
}

func newStateStore() *stateStore {
	return &stateStore{
		activePlaylists:  make(map[int]ActivePlaylistInstance),
		currentWallpaper: make(map[string]ImageHistoryEntry),
	}
}

func (s *stateStore) GetActivePlaylists() map[int]ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[int]ActivePlaylistInstance, len(s.activePlaylists))
	for k, v := range s.activePlaylists {
		result[k] = v
	}
	return result
}

func (s *stateStore) GetActivePlaylistByID(playlistID int) *ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if inst, ok := s.activePlaylists[playlistID]; ok {
		return &inst
	}
	return nil
}

func (s *stateStore) GetActivePlaylistForMonitor(monitor string) *ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, inst := range s.activePlaylists {
		if slices.Contains(inst.Monitors, monitor) {
			return &inst
		}
	}
	return nil
}

func (s *stateStore) SetActivePlaylist(instance ActivePlaylistInstance) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.activePlaylists[instance.PlaylistID] = instance
}

func (s *stateStore) UpdateActivePlaylist(playlistID int, fn func(*ActivePlaylistInstance)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	inst, ok := s.activePlaylists[playlistID]
	if !ok {
		return false
	}
	fn(&inst)
	s.activePlaylists[playlistID] = inst
	return true
}

func (s *stateStore) RemoveActivePlaylist(playlistID int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.activePlaylists, playlistID)
}

func (s *stateStore) RemoveAllActivePlaylists() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.activePlaylists = make(map[int]ActivePlaylistInstance)
}

func (s *stateStore) GetCurrentWallpaper(monitor string) *ImageHistoryEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if entry, ok := s.currentWallpaper[monitor]; ok {
		return &entry
	}
	return nil
}

func (s *stateStore) SetCurrentWallpaper(monitor string, entry ImageHistoryEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.currentWallpaper[monitor] = entry
}
