import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../stores/monitors";
import type { ActivePlaylistInstance, PlaylistImage } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { logger } from "../utils/logger";
import { shouldSkipPlaylistStartAfterUpdate } from "../utils/skipStartAfterPlaylistSave";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { daemonClient } from "@/client";

interface Props {
  currentPlaylistName: string;
  onPlaylistChanged: () => void;
}

const SavePlaylistModal = ({ currentPlaylistName, onPlaylistChanged }: Props) => {
  const { setName, readPlaylist, setPlaylist, markClean } = usePlaylistStore(
    useShallow((s) => ({
      setName: s.setName,
      readPlaylist: s.readPlaylist,
      setPlaylist: s.setPlaylist,
      markClean: s.markClean,
    })),
  );
  const [error, showError] = useState({ state: false, message: "" });
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);
  const modalRef = useRef<ModalHandle>(null);

  const checkDuplicateTimes = (images: PlaylistImage[]) => {
    let duplicatesExist = false;
    const maxImageIndex = images.length;
    let lastTime = -1;
    for (let current = 0; current < maxImageIndex; current++) {
      const time = images[current].time;
      if (time != null && time === lastTime) {
        duplicatesExist = true;
      } else if (time != null) {
        lastTime = time;
      }
    }
    return duplicatesExist;
  };

  const form = useForm({
    defaultValues: { playlistName: "" },
    onSubmit: async ({ value }) => {
      if (monitorSelection.selectedMonitors.length === 0) {
        showError({
          state: true,
          message: "Select at least one display before saving a playlist.",
        });
        return;
      }
      setName(value.playlistName);
      const playlist = readPlaylist();
      if (playlist.configuration.type === "time_of_day") {
        if (checkDuplicateTimes(playlist.images)) {
          showError({
            state: true,
            message: "There are duplicate times in images, check them before resubmitting.",
          });
          return;
        } else {
          showError({ state: false, message: "" });
        }
      }
      const monitorTarget =
        monitorSelection.selectedMonitors.length === 1 ? monitorSelection.selectedMonitors[0] : "*";
      try {
        let savedId: number;
        let activeAfterSave: ActivePlaylistInstance[] | undefined;

        if (playlist.id) {
          await daemonClient.updatePlaylist(playlist.id, {
            name: value.playlistName,
            images: playlist.images,
            configuration: playlist.configuration,
          });
          savedId = playlist.id;
          // PATCH reconcile updates current_index/current_image_id — refresh UI immediately.
          activeAfterSave = await daemonClient.getActivePlaylists();
          const refreshed = activeAfterSave.find((ap) => ap.playlist_id === savedId);
          if (refreshed) {
            useActivePlaylistStore.getState().setActivePlaylist(refreshed);
          }
        } else {
          const created = await daemonClient.createPlaylist({
            name: value.playlistName,
            images: playlist.images,
            configuration: playlist.configuration,
          });
          savedId = created.id;
          setPlaylist({
            ...playlist,
            id: created.id,
            name: value.playlistName,
          });
        }

        if (monitorSelection.selectedMonitors.length > 0) {
          let skipStart = false;
          if (playlist.id) {
            if (activeAfterSave === undefined) {
              activeAfterSave = await daemonClient.getActivePlaylists();
            }
            skipStart = shouldSkipPlaylistStartAfterUpdate({
              savedId,
              playlistType: playlist.configuration.type,
              activePlaylists: activeAfterSave ?? [],
              selectedMonitors: monitorSelection.selectedMonitors,
              mode: monitorSelection.mode,
            });
          }
          if (!skipStart) {
            try {
              await daemonClient.startPlaylist(savedId, monitorTarget, monitorSelection.mode);
            } catch (startErr) {
              logger.error("Failed to start playlist:", startErr);
            }
          }
        }

        markClean();
        onPlaylistChanged();
        modalRef.current?.close();
      } catch (err) {
        logger.error("Failed to save playlist:", err);
        let errorDetail = "Unknown error";
        if (err instanceof Error) errorDetail = err.message;
        showError({
          state: true,
          message: `Failed to save playlist: ${errorDetail}`,
        });
      }
    },
  });

  useEffect(() => {
    if (modalRef.current) {
      useModalStore.getState().register("savePlaylistModal", modalRef.current);
    }
    return () => useModalStore.getState().unregister("savePlaylistModal");
  }, []);

  useEffect(() => {
    form.setFieldValue("playlistName", currentPlaylistName);
  }, [currentPlaylistName, form]);
  const formBody = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <label htmlFor="playlistName" className="label italic text-warning">
        Playlists with the same name will be overwritten.
      </label>

      <form.Field name="playlistName">
        {(field) => (
          <input
            type="text"
            id="playlistName"
            name={field.name}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            required
            draggable={false}
            className="input input-bordered mb-3 w-full text-lg rounded-[var(--wp-radius-md)]"
            placeholder="Playlist Name"
          />
        )}
      </form.Field>
      <div className="divider"></div>
      {error.state && (
        <label htmlFor="playlistName" className="label italic text-lg text-error">
          {error.message}
        </label>
      )}
      <button type="submit" className="btn btn-active uppercase rounded-[var(--wp-radius-md)]">
        Save
      </button>
    </form>
  );

  return (
    <Modal
      id="savePlaylistModal"
      ref={modalRef}
      stripedHeader={{
        title: "Save Playlist",
        subtitle: "Write the playlist to disk and optionally start playback on selected displays.",
        bleedInsetDefault: false,
      }}
      className="modal-box flex max-w-lg flex-col xl:max-w-xl 2xl:max-w-2xl max-h-[90vh] overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8 pt-6">{formBody}</div>
    </Modal>
  );
};

export default SavePlaylistModal;
