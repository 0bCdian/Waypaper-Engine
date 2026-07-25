import { create } from "zustand";
import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

const STORAGE_KEY = "waypaper-active-playlist";

function loadPersisted(): ActivePlaylistInstance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActivePlaylistInstance;
  } catch {
    return null;
  }
}

function persist(playlist: ActivePlaylistInstance | null) {
  try {
    if (playlist) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlist));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

interface ActivePlaylistState {
  activePlaylist: ActivePlaylistInstance | null;
  setActivePlaylist: (playlist: ActivePlaylistInstance | null) => void;
  clear: () => void;
  // Tracks the playlist_id whose full data (images, configuration) was last synced
  // into usePlaylistStore, so repeated events for the same active playlist don't
  // re-fetch its full payload. Lives here (rather than a ref inside
  // useSetLastActivePlaylist) because refreshActivePlaylist, called from
  // useResyncOnReconnect, needs to share this tracking to behave the same way
  // the in-hook listeners do.
  lastSyncedPlaylistId: number | null;
  setLastSyncedPlaylistId: (id: number | null) => void;
}

export const useActivePlaylistStore = create<ActivePlaylistState>()((set) => ({
  activePlaylist: loadPersisted(),
  lastSyncedPlaylistId: null,

  setActivePlaylist: (playlist) => {
    persist(playlist);
    set({ activePlaylist: playlist });
  },

  clear: () => {
    persist(null);
    set({ activePlaylist: null, lastSyncedPlaylistId: null });
  },

  setLastSyncedPlaylistId: (id) => {
    set({ lastSyncedPlaylistId: id });
  },
}));
