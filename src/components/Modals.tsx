import { useState, useEffect } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import AddToPlaylistModal from "./AddToPlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { playlistStore } from "../stores/playlist";
import { imagesStore } from "../stores/images";
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
					// @ts-expect-error daisy-ui
					window.monitors.showModal();
				});
			}, 300);
		});
	}, []);

	const [shouldReload, setShouldReload] = useState<boolean>(false);
	const { playlist } = playlistStore();
	const { imagesArray } = imagesStore();
	useEffect(() => {
		setShouldReload(false);
		void goDaemon.getPlaylists().then((playlists) => {
			setPlaylistsInDB(playlists);
		});
	}, [shouldReload, imagesArray]);
	useEffect(() => {
		void goDaemon.getPlaylists().then((newPlaylists) => {
			setPlaylistsInDB(newPlaylists);
		});
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
