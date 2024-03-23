import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import LoadPlaylistModal from './LoadPlaylistModal';
import SavePlaylistModal from './SavePlaylistModal';
import PlaylistConfigurationModal from './PlaylistConfigurationModal';
import playlistStore from '../stores/playlist';
import { imagesStore } from '../stores/images';
import AdvancedFiltersModal from './AdvancedFiltersModal';
import { type playlistSelectType } from '../../electron/database/schema';
import { useAppConfigStore } from '../stores/appConfig';
const { queryPlaylists } = window.API_RENDERER;
const Monitors = lazy(async () => await import('./monitorsModal'));
function Modals() {
    const [playlistsInDB, setPlaylistsInDB] = useState<playlistSelectType[]>(
        []
    );
    const { appConfig, alreadyShown, setAlreadyShown } = useAppConfigStore();
    useEffect(() => {
        if (alreadyShown || !appConfig.showMonitorModalOnStart) return;
        // @ts-expect-error daisy-ui
        window.monitors.showModal();
        setAlreadyShown(true);
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
            <Suspense>
                <Monitors />
            </Suspense>
        </>
    );
}

export default Modals;
