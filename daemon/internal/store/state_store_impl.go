package store

import "sync"

// stateStore is the in-memory implementation of StateStore.
// State is NOT persisted — it is lost on daemon restart.
type stateStore struct {
	mu               sync.RWMutex
	activePlaylists  map[string]ActivePlaylistInstance
	currentWallpaper map[string]ImageHistoryEntry
}

func newStateStore() *stateStore {
	return &stateStore{
		activePlaylists:  make(map[string]ActivePlaylistInstance),
		currentWallpaper: make(map[string]ImageHistoryEntry),
	}
}

func (s *stateStore) GetActivePlaylists() map[string]ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]ActivePlaylistInstance, len(s.activePlaylists))
	for k, v := range s.activePlaylists {
		result[k] = v
	}
	return result
}

func (s *stateStore) GetActivePlaylistByMonitor(monitor string) *ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if inst, ok := s.activePlaylists[monitor]; ok {
		return &inst
	}
	return nil
}

func (s *stateStore) SetActivePlaylist(monitor string, instance ActivePlaylistInstance) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.activePlaylists[monitor] = instance
}

func (s *stateStore) RemoveActivePlaylist(monitor string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.activePlaylists, monitor)
}

func (s *stateStore) RemoveAllActivePlaylists() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.activePlaylists = make(map[string]ActivePlaylistInstance)
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
