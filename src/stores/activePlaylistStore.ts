import { create } from "zustand";
import type { ActivePlaylistResponse } from "../../electron/daemon-go-types";

const STORAGE_KEY = "waypaper-active-playlist";

function loadPersisted(): ActivePlaylistResponse | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as ActivePlaylistResponse;
	} catch {
		return null;
	}
}

function persist(playlist: ActivePlaylistResponse | null) {
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
	activePlaylist: ActivePlaylistResponse | null;
	setActivePlaylist: (playlist: ActivePlaylistResponse | null) => void;
	clear: () => void;
}

export const useActivePlaylistStore = create<ActivePlaylistState>()((set) => ({
	activePlaylist: loadPersisted(),

	setActivePlaylist: (playlist) => {
		persist(playlist);
		set({ activePlaylist: playlist });
	},

	clear: () => {
		persist(null);
		set({ activePlaylist: null });
	},
}));
