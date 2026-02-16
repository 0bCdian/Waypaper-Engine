import { useState, useEffect } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import AddToPlaylistModal from "./AddToPlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { usePlaylistStore } from "../stores/playlist";
import AdvancedFiltersModal from "./AdvancedFiltersModal";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import Monitors from "./monitorsModal";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
const goDaemon = window.API_RENDERER.goDaemon;
let alreadyShown = false;
function Modals() {
	// All hooks grouped at the top
	const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>([]);
	const { setLastSavedMonitorConfig, reQueryMonitors } = useMonitorStore(
		useShallow((s) => ({
			setLastSavedMonitorConfig: s.setLastSavedMonitorConfig,
			reQueryMonitors: s.reQueryMonitors,
		})),
	);
	const [shouldReload, setShouldReload] = useState<boolean>(false);
	const playlist = usePlaylistStore((s) => s.playlist);

	useEffect(() => {
		if (alreadyShown) return;
		alreadyShown = true;
		void setLastSavedMonitorConfig().then(() => {
			const config = useSettingsStore.getState().config;
			if (!config || !config.app.show_monitor_modal_on_start) return;
			setTimeout(() => {
				void reQueryMonitors().then(() => {
					window.monitors?.showModal();
				});
			}, 300);
		});
	}, [reQueryMonitors, setLastSavedMonitorConfig]);

	useEffect(() => {
		void goDaemon.getPlaylists().then((playlists) => {
			setPlaylistsInDB(playlists);
		});
		if (shouldReload) {
			setShouldReload(false);
		}
	}, [shouldReload]);

	useEffect(() => {
		const api = window.API_RENDERER?.goDaemon;
		if (!api?.on || !api?.off) return;

		const handlePlaylistsUpdated = () => {
			void goDaemon.getPlaylists().then((playlists) => {
				setPlaylistsInDB(playlists);
			});
		};

		api.on("playlists_updated", handlePlaylistsUpdated);
		return () => {
			api.off("playlists_updated", handlePlaylistsUpdated);
		};
	}, []);

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
