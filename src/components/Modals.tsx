import { useState, useEffect, useMemo } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import playlistStore from "../hooks/playlistStore";
import { type Playlist } from "../../electron/types/types";
import { useImages } from "../hooks/imagesStore";
import AdvancedFiltersModal from "./AdvancedFiltersModal";

const { queryPlaylists } = window.API_RENDERER;
function Modals() {
    const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>([]);
    const [shouldReload, setShouldReload] = useState<boolean>(false);
    const { readPlaylist, isEmpty } = playlistStore();
    const { imagesArray } = useImages();
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
        </>
    );
}

export default Modals;
