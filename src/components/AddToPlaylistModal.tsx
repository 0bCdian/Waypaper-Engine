import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useImagesStore } from "../stores/images";
import type { Playlist } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { logger } from "../utils/logger";
import { daemonClient } from "@/client";

interface Props {
  playlistsInDB: Playlist[];
  onPlaylistChanged: () => void;
}

const AddToPlaylistModal = ({ playlistsInDB, onPlaylistChanged }: Props) => {
  const selectedImages = useImagesStore((s) => s.selectedImages);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const modalRef = useRef<ModalHandle>(null);

  const clearModalFeedback = () => {
    setError("");
    setSuccess("");
  };

  const form = useForm({
    defaultValues: {
      selectPlaylist: playlistsInDB.length > 0 ? String(playlistsInDB[0].id) : "",
    },
    onSubmit: async ({ value }) => {
      try {
        setError("");
        setSuccess("");

        const selectedId = Number(value.selectPlaylist);
        const selectedPlaylist = playlistsInDB.find((playlist) => playlist.id === selectedId);

        if (!selectedPlaylist) {
          setError("Selected playlist not found");
          return;
        }

        const imageIdsToAdd = Array.from(selectedImages);

        if (imageIdsToAdd.length === 0) {
          setError("No images selected");
          return;
        }

        const fullPlaylist = await daemonClient.getPlaylist(selectedPlaylist.id);
        const existingImageIds = new Set(fullPlaylist.images.map((img) => img.image_id));

        const newImageIds = imageIdsToAdd.filter((id) => !existingImageIds.has(id));

        if (newImageIds.length === 0) {
          setError("All selected images are already in this playlist");
          setTimeout(() => setError(""), 3000);
          return;
        }

        const updatedImages = [
          ...fullPlaylist.images,
          ...newImageIds.map((id) => ({ image_id: id })),
        ];

        await daemonClient.updatePlaylist(selectedPlaylist.id, {
          images: updatedImages,
        });

        let successMsg: string;
        if (newImageIds.length > 1) {
          successMsg = `Added ${newImageIds.length} images to ${selectedPlaylist.name}`;
        } else {
          successMsg = `Added ${newImageIds.length} image to ${selectedPlaylist.name}`;
        }
        setSuccess(successMsg);
        onPlaylistChanged();

        setTimeout(() => {
          clearModalFeedback();
          modalRef.current?.close();
        }, 1500);
      } catch (err) {
        logger.error("Failed to add images to playlist:", err);
        let errorMsg = "Failed to add images to playlist";
        if (err instanceof Error) errorMsg = err.message;
        setError(errorMsg);
      }
    },
  });

  const content = (
    <>
      {error.length > 0 && (
        <div role="alert" className="alert alert-error m-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {success.length > 0 && (
        <div role="alert" className="alert alert-success m-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {selectedImages.size === 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-center text-xl font-medium italic">No images selected</span>
        </section>
      )}

      {selectedImages.size > 0 && (
        <section className="mb-3">
          <span className="text-lg">Selected images: {selectedImages.size}</span>
        </section>
      )}

      {playlistsInDB && playlistsInDB.length === 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-center text-xl font-medium italic">
            No playlists found, create a new one first
          </span>
          <button
            type="button"
            className="btn btn-active btn-block uppercase"
            onClick={() => {
              onPlaylistChanged();
            }}
          >
            Refresh playlists
          </button>
        </section>
      )}

      {playlistsInDB && playlistsInDB.length > 0 && selectedImages.size > 0 && (
        <form
          // oxlint-disable-next-line react-doctor/no-prevent-default -- Electron app; not a server-rendered form, no progressive-enhancement use case
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="form-control flex flex-col gap-5"
        >
          <label htmlFor="selectPlaylist" className="label text-lg">
            Select Playlist
          </label>

          <form.Field name="selectPlaylist">
            {(field) => (
              <select
                id="selectPlaylist"
                className="select select-bordered w-full text-lg rounded-[var(--wp-radius-md)]"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              >
                {playlistsInDB.map((playlist) => (
                  <option key={playlist.id} value={String(playlist.id)}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            )}
          </form.Field>

          <div className="mt-3 flex justify-center gap-3">
            <button
              type="button"
              className="btn btn-md uppercase rounded-[var(--wp-radius-md)]"
              onClick={() => {
                clearModalFeedback();
                modalRef.current?.close();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-active btn-md uppercase rounded-[var(--wp-radius-md)]"
            >
              Add to Playlist
            </button>
          </div>
        </form>
      )}
    </>
  );

  return (
    <Modal
      id="AddToPlaylistModal"
      ref={modalRef}
      onClose={clearModalFeedback}
      stripedHeader={{
        title: "Add to Playlist",
        subtitle:
          "Append the current gallery selection to a saved playlist. Duplicate image IDs are skipped.",
        bleedInsetDefault: false,
      }}
      className="modal-box flex max-w-lg flex-col xl:max-w-xl 2xl:max-w-2xl max-h-[90vh] overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-6">
        {content}
      </div>
    </Modal>
  );
};

export default AddToPlaylistModal;
