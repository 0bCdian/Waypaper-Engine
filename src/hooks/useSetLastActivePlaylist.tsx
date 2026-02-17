import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import type { rendererPlaylist } from "../types/rendererTypes";
import { useEffect } from "react";
import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

export function useSetLastActivePlaylist() {
	const { setPlaylist, playlist } = usePlaylistStore(
		useShallow((s) => ({
			setPlaylist: s.setPlaylist,
			playlist: s.playlist,
		})),
	);
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);

	useEffect(() => {
		if (monitorSelection.selectedMonitors.length === 0) return;

		const monitorName = monitorSelection.selectedMonitors[0];
		if (!monitorName) return;

		void goDaemon
			.getActivePlaylistForMonitor(monitorName)
			.then(async (activePlaylist: ActivePlaylistInstance) => {
				if (!activePlaylist) return;

				const fullPlaylist = await goDaemon.getPlaylist(
					activePlaylist.playlist_id,
				);
				if (
					!fullPlaylist ||
					!fullPlaylist.images ||
					fullPlaylist.images.length < 1
				) {
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
				await useImagesStore
					.getState()
					.fetchMissingImages(
						fullPlaylist.images.map((img) => img.image_id),
					);
			})
			.catch(() => {
				// No active playlist for this monitor
			});
	}, [monitorSelection, playlist.name, setPlaylist]);
}
