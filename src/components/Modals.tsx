import { useState, useEffect, useCallback } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import AddToPlaylistModal from "./AddToPlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { playlistStore } from "../stores/playlist";
import AdvancedFiltersModal from "./AdvancedFiltersModal";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";
import Monitors from "./monitorsModal";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
const goDaemon = window.API_RENDERER.goDaemon;
let alreadyShown = false;
function Modals() {
	const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>(
		[],
	);
	const { config } = useUnifiedConfigStore();
	const { setLastSavedMonitorConfig, reQueryMonitors } = useMonitorStore();
	useEffect(() => {
		if (alreadyShown) return;
		alreadyShown = true;
		void setLastSavedMonitorConfig().then(() => {
			if (!config || !config.app.show_monitor_modal_on_start) return;
			setTimeout(() => {
				void reQueryMonitors().then(() => {
					window.monitors?.showModal();
				});
			}, 300);
		});
	}, []);

	const [shouldReload, setShouldReload] = useState<boolean>(false);
	const { playlist } = playlistStore();

	const fetchPlaylists = useCallback(() => {
		void goDaemon.getPlaylists().then((playlists) => {
			setPlaylistsInDB(playlists);
		});
	}, []);

	// Fetch on mount and when shouldReload changes
	useEffect(() => {
		fetchPlaylists();
		if (shouldReload) {
			setShouldReload(false);
		}
	}, [shouldReload, fetchPlaylists]);

	// Listen for playlists_updated SSE event from daemon
	useEffect(() => {
		const api = window.API_RENDERER?.goDaemon;
		if (!api?.on || !api?.off) return;

		const handlePlaylistsUpdated = () => {
			fetchPlaylists();
		};

		api.on("playlists_updated", handlePlaylistsUpdated);
		return () => {
			api.off("playlists_updated", handlePlaylistsUpdated);
		};
	}, [fetchPlaylists]);

	return (
		<>
			<LoadPlaylistModal
				playlistsInDB={playlistsInDB}
				setShouldReload={setShouldReload}
				currentPlaylistName={playlist.name}
			/>
			<SavePlaylistModal
				setShouldReload={setShouldReload}
				currentPlaylistName={playlist.name}
			/>
			<AddToPlaylistModal
				playlistsInDB={playlistsInDB}
				setShouldReload={setShouldReload}
			/>
			<PlaylistConfigurationModal />
			<AdvancedFiltersModal />
			<Monitors />
		</>
	);
}

export default Modals;
