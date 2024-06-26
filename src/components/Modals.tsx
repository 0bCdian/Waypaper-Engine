import { useState, useEffect } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { playlistStore } from "../stores/playlist";
import { imagesStore } from "../stores/images";
import AdvancedFiltersModal from "./AdvancedFiltersModal";
import { type playlistSelectType } from "../../database/schema";
import { useAppConfigStore } from "../stores/appConfig";
import Monitors from "./monitorsModal";
import { useMonitorStore } from "../stores/monitors";
const { queryPlaylists } = window.API_RENDERER;
let alreadyShown = false;
function Modals() {
    const [playlistsInDB, setPlaylistsInDB] = useState<playlistSelectType[]>(
        []
    );
    const { appConfig, isSetup } = useAppConfigStore();
    const { setLastSavedMonitorConfig, reQueryMonitors } = useMonitorStore();
    useEffect(() => {
        if (alreadyShown) return;
        alreadyShown = true;
        void setLastSavedMonitorConfig().then(() => {
            if (!isSetup || !appConfig.showMonitorModalOnStart) return;
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
        void queryPlaylists().then(playlists => {
            setPlaylistsInDB(playlists);
        });
    }, [shouldReload, imagesArray]);
    useEffect(() => {
        void queryPlaylists().then(newPlaylists => {
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
            <PlaylistConfigurationModal />
            <AdvancedFiltersModal />
            <Monitors />
        </>
    );
}

export default Modals;
