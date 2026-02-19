import { create } from "zustand";
import type { ActivePlaylistResponse } from "../../electron/daemon-go-types";

interface ActivePlaylistState {
	activePlaylist: ActivePlaylistResponse | null;
	setActivePlaylist: (playlist: ActivePlaylistResponse | null) => void;
	clear: () => void;
}

export const useActivePlaylistStore = create<ActivePlaylistState>()((set) => ({
	activePlaylist: null,

	setActivePlaylist: (playlist) => set({ activePlaylist: playlist }),

	clear: () => set({ activePlaylist: null }),
}));
