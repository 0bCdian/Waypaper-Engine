import { useState, useEffect, useRef } from "react";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import AddToPlaylistModal from "./AddToPlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { usePlaylistStore } from "../stores/playlist";
import AdvancedFiltersModal from "./AdvancedFiltersModal";
import FolderImportModal from "./FolderImportModal";
import FolderPickerModal from "./FolderPickerModal";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import { useModalStore } from "../stores/modalStore";
import Monitors from "./MonitorsModal";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
const goDaemon = window.API_RENDERER.goDaemon;

function Modals() {
  const alreadyShown = useRef(false);
  const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>([]);
  const { setLastSavedMonitorConfig, reQueryMonitors } = useMonitorStore(
    useShallow((s) => ({
      setLastSavedMonitorConfig: s.setLastSavedMonitorConfig,
      reQueryMonitors: s.reQueryMonitors,
    })),
  );
  const playlist = usePlaylistStore((s) => s.playlist);

  const config = useSettingsStore((s) => s.config);

  const reloadPlaylists = () => {
    void goDaemon.getPlaylists().then((playlists) => {
      setPlaylistsInDB(playlists);
    });
  };

  useEffect(() => {
    if (alreadyShown.current || !config) return;
    alreadyShown.current = true;
    if (!config.app.show_monitor_modal_on_start) return;
    void setLastSavedMonitorConfig().then(() => {
      setTimeout(() => {
        void reQueryMonitors().then(() => {
          useModalStore.getState().open("monitors");
        });
      }, 300);
    });
  }, [config, reQueryMonitors, setLastSavedMonitorConfig]);

  useEffect(() => {
    reloadPlaylists();
  }, []);

  useEffect(() => {
    const dispose = goDaemon.on("playlists_updated", () => {
      void goDaemon.getPlaylists().then((playlists) => {
        setPlaylistsInDB(playlists);
      });
    });
    return dispose;
  }, []);

  return (
    <>
      <LoadPlaylistModal
        playlistsInDB={playlistsInDB}
        onPlaylistChanged={reloadPlaylists}
        currentPlaylistName={playlist.name}
      />
      <SavePlaylistModal onPlaylistChanged={reloadPlaylists} currentPlaylistName={playlist.name} />
      <AddToPlaylistModal playlistsInDB={playlistsInDB} onPlaylistChanged={reloadPlaylists} />
      <PlaylistConfigurationModal />
      <AdvancedFiltersModal />
      <FolderImportModal />
      <FolderPickerModal />
      <Monitors />
    </>
  );
}

export default Modals;
