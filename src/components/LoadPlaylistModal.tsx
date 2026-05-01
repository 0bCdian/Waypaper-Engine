import { useRef, useState, useEffect } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useForm, useStore } from "@tanstack/react-form";
import type { MonitorMode } from "../../electron/daemon-go-types";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { confirmDialog } from "./ConfirmDialog";
import { logger } from "../utils/logger";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";
import { daemonClient } from "@/client";

interface Props {
  playlistsInDB: Playlist[];
  currentPlaylistName: string;
  onPlaylistChanged: () => void;
}

type LoadPlaylistResult =
  | { ok: true; playlist: import("../types/rendererTypes").rendererPlaylist }
  | { ok: false; message: string };

async function loadAndStartPlaylist(
  playlistId: number,
  monitor: string,
  mode: MonitorMode | undefined,
): Promise<LoadPlaylistResult> {
  try {
    const fullPlaylist = await daemonClient.getPlaylist(playlistId);
    await daemonClient.startPlaylist(fullPlaylist.id, monitor, mode);
    return {
      ok: true,
      playlist: {
        id: fullPlaylist.id,
        name: fullPlaylist.name,
        configuration: fullPlaylist.configuration,
        images: fullPlaylist.images,
      },
    };
  } catch (err) {
    logger.error("Failed to load playlist:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

const LoadPlaylistModal = ({ playlistsInDB, onPlaylistChanged, currentPlaylistName }: Props) => {
  const isNeo = useIsNeo();
  const { clearPlaylist, setPlaylist } = usePlaylistStore(
    useShallow((s) => ({
      clearPlaylist: s.clearPlaylist,
      setPlaylist: s.setPlaylist,
    })),
  );
  const [error, setError] = useState("");
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);
  const modalRef = useRef<ModalHandle>(null);

  const form = useForm({
    defaultValues: {
      selectPlaylist: playlistsInDB.length > 0 ? String(playlistsInDB[0].id) : "",
    },
    onSubmit: async ({ value }) => {
      const selectedId = Number(value.selectPlaylist);
      const selectedPlaylist = playlistsInDB.find((p) => p.id === selectedId);

      if (selectedPlaylist === undefined) {
        setError("Please select a valid playlist");
        setTimeout(() => setError(""), 3000);
        return;
      }

      if (monitorSelection.selectedMonitors.length < 1) {
        setError("Select at least one display before loading a playlist");
        setTimeout(() => setError(""), 3000);
        return;
      }

      const monitor =
        monitorSelection.selectedMonitors.length === 1 ? monitorSelection.selectedMonitors[0] : "*";
      const result = await loadAndStartPlaylist(
        selectedPlaylist.id,
        monitor,
        monitorSelection.mode,
      );
      if (result.ok) {
        clearPlaylist();
        setPlaylist(result.playlist);
        void useImagesStore
          .getState()
          .fetchMissingImages(result.playlist.images.map((img) => img.image_id));
        closeModal();
      } else {
        setError(`Failed to load playlist: ${result.message}`);
        setTimeout(() => setError(""), 5000);
      }
    },
  });

  const currentSelection = useStore(form.store, (s) => s.values.selectPlaylist);

  useEffect(() => {
    if (modalRef.current) {
      useModalStore.getState().register("LoadPlaylistModal", modalRef.current);
    }
    return () => useModalStore.getState().unregister("LoadPlaylistModal");
  }, []);

  const closeModal = () => {
    modalRef.current?.close();
  };

  return (
    <Modal
      id="LoadPlaylistModal"
      ref={modalRef}
      stripedHeader={{
        title: "Load Playlist",
        subtitle:
          "Pick a saved playlist from the library. It will replace the current strip and start on your selected display(s).",
      }}
      className={cn(
        "modal-box flex max-w-lg flex-col xl:max-w-xl 2xl:max-w-2xl",
        isNeo ? "max-h-[90vh] overflow-hidden p-0" : "gap-4 p-6",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6",
          isNeo ? "overflow-y-auto px-6 pb-8 pt-8" : "",
        )}
      >
        {error.length > 0 && (
          <div role="alert" className="alert alert-error m-0 shadow-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-left font-[family-name:var(--font-body)] text-sm font-semibold leading-relaxed md:text-base">
              {error}
            </span>
          </div>
        )}

        {playlistsInDB && playlistsInDB.length === 0 && (
          <section
            className={cn(
              "flex flex-col gap-4",
              isNeo ? "bg-base-200 p-6" : "rounded-lg bg-base-200 p-5",
            )}
          >
            <p className="text-left font-[family-name:var(--font-body)] text-base font-medium leading-[1.6] text-base-content md:text-lg">
              No playlists in the library yet. Save one from the strip or refresh after syncing.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                onPlaylistChanged();
              }}
            >
              Refresh playlists
            </button>
          </section>
        )}

        {playlistsInDB && playlistsInDB.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className={cn(
              "form-control flex flex-col gap-6",
              isNeo ? "bg-base-200 p-6" : "rounded-lg bg-base-200 p-5",
            )}
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="selectPlaylist"
                className={cn(
                  "label cursor-pointer justify-start p-0 font-[family-name:var(--font-display)] text-sm font-extrabold uppercase tracking-wide text-base-content md:text-base",
                )}
              >
                Select playlist
              </label>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <form.Field name="selectPlaylist">
                  {(field) => (
                    <select
                      id="selectPlaylist"
                      className="select select-bordered min-h-12 w-full flex-1 text-base md:text-lg"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    >
                      <option value="" disabled>
                        Choose a playlist…
                      </option>
                      {playlistsInDB.map((playlist) => (
                        <option key={playlist.id} value={String(playlist.id)}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                  )}
                </form.Field>
                <button
                  type="button"
                  className="btn btn-error shrink-0 sm:w-auto sm:min-w-[7.5rem]"
                  onClick={async () => {
                    const currentId = Number(currentSelection);
                    if (!currentSelection || Number.isNaN(currentId)) {
                      setError("Please select a playlist to delete");
                      return;
                    }

                    const playlistToDelete = playlistsInDB.find((p) => p.id === currentId);
                    if (!playlistToDelete) return;

                    const shouldDelete = await confirmDialog({
                      title: "Delete Playlist",
                      message: `Are you sure you want to delete "${playlistToDelete.name}"? This action cannot be undone.`,
                      confirmLabel: "Delete",
                      cancelLabel: "Cancel",
                      danger: true,
                    });
                    if (shouldDelete) {
                      try {
                        await daemonClient.stopPlaylist(playlistToDelete.id).catch(() => {});
                        await daemonClient.deletePlaylist(playlistToDelete.id);
                        onPlaylistChanged();
                        setError("");

                        if (currentPlaylistName !== "") {
                          clearPlaylist();
                        }
                      } catch (deleteErr) {
                        logger.error("Failed to delete playlist:", deleteErr);
                        setError(
                          `Failed to delete playlist: ${deleteErr instanceof Error ? deleteErr.message : "Unknown error"}`,
                        );
                      }
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 border-t-4 border-base-content/15 pt-6 sm:gap-4">
              <button type="button" className="btn btn-ghost min-w-[6.5rem]" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary min-w-[6.5rem]">
                Load
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default LoadPlaylistModal;
