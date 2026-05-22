import { useState, useEffect, useRef } from "react";
import { SettingsModal } from "./settings/SettingsModal";
import LoadPlaylistModal from "./LoadPlaylistModal";
import SavePlaylistModal from "./SavePlaylistModal";
import AddToPlaylistModal from "./AddToPlaylistModal";
import PlaylistConfigurationModal from "./PlaylistConfigurationModal";
import { usePlaylistStore } from "../stores/playlist";
import AdvancedFiltersModal from "./AdvancedFiltersModal";
import GalleryFilterCheatsheetModal from "./GalleryFilterCheatsheetModal";
import FolderImportModal from "./FolderImportModal";
import FolderPickerModal from "./FolderPickerModal";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import { useModalStore } from "../stores/modalStore";
import Monitors from "./MonitorsModal";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
import { daemonClient } from "@/client";
import { useStartupIntroGateStore } from "../stores/startupIntroGateStore";

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
  const introFinished = useStartupIntroGateStore((s) => s.introFinished);

  const reloadPlaylists = () => {
    void daemonClient.getPlaylists().then((playlists) => {
      setPlaylistsInDB(playlists);
    });
  };

  useEffect(() => {
    if (alreadyShown.current || !config) return;
    if (!config.app.show_monitor_modal_on_start) {
      alreadyShown.current = true;
      return;
    }
    if (!introFinished) return;
    alreadyShown.current = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    void setLastSavedMonitorConfig().then(() => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        void reQueryMonitors().then(() => {
          if (!cancelled) useModalStore.getState().open("monitors");
        });
      }, 300);
    });
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [config, introFinished, reQueryMonitors, setLastSavedMonitorConfig]);

  useEffect(() => {
    reloadPlaylists();
  }, []);

  useEffect(() => {
    const dispose = daemonClient.on("gallery_changed", (data: unknown) => {
      const payload = data as { domain?: string };
      if (payload?.domain !== "playlists") return;
      void daemonClient.getPlaylists().then((playlists) => {
        setPlaylistsInDB(playlists);
      });
    });
    return dispose;
  }, []);

  return (
    <>
      <SettingsModal />
      <LoadPlaylistModal
        playlistsInDB={playlistsInDB}
        onPlaylistChanged={reloadPlaylists}
        currentPlaylistName={playlist.name}
      />
      <SavePlaylistModal onPlaylistChanged={reloadPlaylists} currentPlaylistName={playlist.name} />
      <AddToPlaylistModal playlistsInDB={playlistsInDB} onPlaylistChanged={reloadPlaylists} />
      <PlaylistConfigurationModal />
      <AdvancedFiltersModal />
      <GalleryFilterCheatsheetModal />
      <FolderImportModal />
      <FolderPickerModal />
      <Monitors />
    </>
  );
}

export default Modals;
