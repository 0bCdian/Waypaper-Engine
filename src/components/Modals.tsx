import { useState, useEffect, useMemo } from 'react';
import LoadPlaylistModal from './LoadPlaylistModal';
import SavePlaylistModal from './SavePlaylistModal';
import PlaylistConfigurationModal from './PlaylistConfigurationModal';
import { playlistStore } from '../stores/playlist';
import { imagesStore } from '../stores/images';
import AdvancedFiltersModal from './AdvancedFiltersModal';
import { type playlistSelectType } from '../../electron/database/schema';
import { useAppConfigStore } from '../stores/appConfig';
import Monitors from './monitorsModal';
import { useMonitorStore } from '../stores/monitors';
const { queryPlaylists, querySelectedMonitor } = window.API_RENDERER;
let alreadyShown = false;
function Modals() {
    const [playlistsInDB, setPlaylistsInDB] = useState<playlistSelectType[]>(
        []
    );
    const { appConfig, isSetup } = useAppConfigStore();
    const { setActiveMonitor, reQueryMonitors } = useMonitorStore();
    useEffect(() => {
        void querySelectedMonitor().then(lastSelectedMonitor => {
            if (lastSelectedMonitor !== undefined) {
                setActiveMonitor(lastSelectedMonitor);
            }
            void reQueryMonitors().then(() => {
                if (
                    !isSetup ||
                    !appConfig.showMonitorModalOnStart ||
                    alreadyShown
                )
                    return;
                setTimeout(() => {
                    // @ts-expect-error daisy-ui
                    window.monitors.showModal();
                    alreadyShown = true;
                }, 300);
            });
        });
    }, []);

    const [shouldReload, setShouldReload] = useState<boolean>(false);
    const { readPlaylist, isEmpty } = playlistStore();
    const { imagesArray } = imagesStore();
    const currentPlaylist = useMemo(() => {
        return readPlaylist();
    }, [shouldReload, isEmpty]);
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
                currentPlaylistName={currentPlaylist.name}
            />
            <SavePlaylistModal
                setShouldReload={setShouldReload}
                currentPlaylistName={currentPlaylist.name}
            />
            <PlaylistConfigurationModal />
            <AdvancedFiltersModal />
            <Monitors />
        </>
    );
}

export default Modals;
