import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { useShallow } from "zustand/react/shallow";
import type { rendererPlaylist } from "../types/rendererTypes";
import { useEffect, useRef } from "react";
import type { ActivePlaylistInstance, MonitorMode } from "../../electron/daemon-go-types";
import { daemonClient } from "@/client";


function monitorSetsMatch(
  selected: string[],
  selectedMode: MonitorMode,
  playlistMonitors: string[],
  playlistMode: MonitorMode,
): boolean {
  if (selectedMode !== playlistMode) return false;
  if (selected.length !== playlistMonitors.length) return false;
  const a = new Set(selected);
  return playlistMonitors.every((m) => a.has(m));
}

export function useSetLastActivePlaylist() {
  const { setPlaylist, clearPlaylist } = usePlaylistStore(
    useShallow((s) => ({
      setPlaylist: s.setPlaylist,
      clearPlaylist: s.clearPlaylist,
    })),
  );
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);
  const setActivePlaylist = useActivePlaylistStore((s) => s.setActivePlaylist);
  const clearActivePlaylist = useActivePlaylistStore((s) => s.clear);
  const lastSyncedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (monitorSelection.selectedMonitors.length === 0) {
      clearPlaylist();
      clearActivePlaylist();
      return;
    }

    let cancelled = false;

    void daemonClient
      .getActivePlaylists()
      .then(async (activePlaylists: ActivePlaylistInstance[]) => {
        if (cancelled) return;

        if (!activePlaylists || activePlaylists.length === 0) {
          clearPlaylist();
          clearActivePlaylist();
          lastSyncedIdRef.current = null;
          return;
        }

        const match = activePlaylists.find((ap) =>
          monitorSetsMatch(
            monitorSelection.selectedMonitors,
            monitorSelection.mode,
            ap.monitors,
            ap.mode,
          ),
        );

        if (!match) {
          clearPlaylist();
          clearActivePlaylist();
          lastSyncedIdRef.current = null;
          return;
        }

        setActivePlaylist(match);

        if (lastSyncedIdRef.current === match.playlist_id) {
          return;
        }

        const fullPlaylist = await daemonClient.getPlaylist(match.playlist_id);
        if (cancelled) return;

        if (!fullPlaylist || !fullPlaylist.images || fullPlaylist.images.length < 1) {
          return;
        }

        lastSyncedIdRef.current = match.playlist_id;
        const currentPlaylist: rendererPlaylist = {
          id: fullPlaylist.id,
          name: fullPlaylist.name,
          configuration: fullPlaylist.configuration,
          images: fullPlaylist.images,
        };
        setPlaylist(currentPlaylist);
        await useImagesStore
          .getState()
          .fetchMissingImages(fullPlaylist.images.map((img) => img.image_id));
      })
      .catch(() => {
        // Network error — leave both stores untouched
      });

    return () => {
      cancelled = true;
    };
  }, [monitorSelection, setPlaylist, clearPlaylist, setActivePlaylist, clearActivePlaylist]);

  useEffect(() => {
    const disposers = [
      daemonClient.on("playlist_started", () => {
        void refreshActivePlaylist();
      }),
      daemonClient.on("playlist_stopped", () => {
        void refreshActivePlaylist();
      }),
      daemonClient.on("playlist_paused", () => {
        void refreshActivePlaylist();
      }),
      daemonClient.on("playlist_resumed", () => {
        void refreshActivePlaylist();
      }),
      daemonClient.on("playlist_image_changed", () => {
        void refreshActivePlaylist();
      }),
      daemonClient.on("gallery_changed", (data: unknown) => {
        const payload = data as { domain?: string };
        if (payload?.domain === "playlists") void refreshActivePlaylist();
      }),
      daemonClient.on("config_changed", (data: unknown) => {
        const event = data as { sections?: string[] };
        if (!event.sections || event.sections.includes("monitors")) {
          void refreshActivePlaylist();
        }
      }),
    ];

    return () => {
      for (const d of disposers) d();
    };

    async function refreshActivePlaylist() {
      const { selectedMonitors, mode } = useMonitorStore.getState().monitorSelection;
      if (selectedMonitors.length === 0) {
        usePlaylistStore.getState().clearPlaylist();
        useActivePlaylistStore.getState().clear();
        lastSyncedIdRef.current = null;
        return;
      }

      let activePlaylists: ActivePlaylistInstance[] | undefined;
      try {
        activePlaylists = await daemonClient.getActivePlaylists();
      } catch {
        return;
      }

      if (!activePlaylists || activePlaylists.length === 0) {
        usePlaylistStore.getState().clearPlaylist();
        useActivePlaylistStore.getState().clear();
        lastSyncedIdRef.current = null;
        return;
      }

      const match = activePlaylists.find((ap) =>
        monitorSetsMatch(selectedMonitors, mode, ap.monitors, ap.mode),
      );

      if (!match) {
        usePlaylistStore.getState().clearPlaylist();
        useActivePlaylistStore.getState().clear();
        lastSyncedIdRef.current = null;
        return;
      }

      useActivePlaylistStore.getState().setActivePlaylist(match);

      if (lastSyncedIdRef.current === match.playlist_id) return;

      try {
        const fullPlaylist = await daemonClient.getPlaylist(match.playlist_id);
        if (!fullPlaylist || !fullPlaylist.images || fullPlaylist.images.length < 1) {
          return;
        }

        lastSyncedIdRef.current = match.playlist_id;
        const currentPlaylist: rendererPlaylist = {
          id: fullPlaylist.id,
          name: fullPlaylist.name,
          configuration: fullPlaylist.configuration,
          images: fullPlaylist.images,
        };
        usePlaylistStore.getState().setPlaylist(currentPlaylist);
        await useImagesStore
          .getState()
          .fetchMissingImages(fullPlaylist.images.map((img) => img.image_id));
      } catch {
        // Playlist fetch failed — keep current state
      }
    }
  }, []);
}
