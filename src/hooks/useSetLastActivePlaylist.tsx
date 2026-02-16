import { playlistStore } from "../stores/playlist";
import { useMonitorStore } from "../stores/monitors";
import { type rendererPlaylist } from "../types/rendererTypes";
import { useEffect } from "react";
import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

export function useSetLastActivePlaylist() {
	const { setPlaylist, playlist } = playlistStore();
	const { monitorSelection } = useMonitorStore();

	useEffect(() => {
		if (monitorSelection.selectedMonitors.length === 0) return;

		const monitorName = monitorSelection.selectedMonitors[0];
		if (!monitorName) return;

		void goDaemon
			.getActivePlaylistForMonitor(monitorName)
			.then(async (activePlaylist: ActivePlaylistInstance) => {
				if (!activePlaylist) return;

				// Fetch the full playlist to get image list
				const fullPlaylist = await goDaemon.getPlaylist(
					activePlaylist.playlist_id,
				);
				if (!fullPlaylist || !fullPlaylist.images || fullPlaylist.images.length < 1) {
					return;
				}

				if (playlist.name === fullPlaylist.name) return;

				const currentPlaylist: rendererPlaylist = {
					id: fullPlaylist.id,
					name: fullPlaylist.name,
					configuration: fullPlaylist.configuration,
					images: fullPlaylist.images,
				};
				setPlaylist(currentPlaylist);
			})
			.catch(() => {
				// No active playlist for this monitor
			});
	}, [monitorSelection]);
}
