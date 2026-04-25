import { useDroppable } from "@dnd-kit/react";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import openImagesStore from "../hooks/useOpenImages";
import { useShallow } from "zustand/react/shallow";

import { useMonitorStore } from "../stores/monitors";
import type { openFileAction } from "../../shared/types";
import { useSetLastActivePlaylist } from "../hooks/useSetLastActivePlaylist";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import { useIsNeo } from "../hooks/useIsNeo";
import { useDragStore } from "../stores/dragStore";
import type { DropTargetData } from "../stores/dragStore";
import { useModalStore } from "../stores/modalStore";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";

const { goDaemon } = window.API_RENDERER;
import MiniPlaylistCard from "./MiniPlaylistCard";

async function stopPlaylistSilent(playlistId: number) {
  try {
    await goDaemon.stopPlaylist(playlistId);
  } catch (error) {
    console.error(error);
  }
}

function PlaylistTrack() {
  const {
    playlist,
    lastAddedImageID,
    isDirty,
    movePlaylistArrayOrder,
    clearPlaylist,
    setPlaylist,
  } = usePlaylistStore(
    useShallow((s) => ({
      playlist: s.playlist,
      lastAddedImageID: s.lastAddedImageID,
      isDirty: s.isDirty,
      movePlaylistArrayOrder: s.movePlaylistArrayOrder,
      clearPlaylist: s.clearPlaylist,
      setPlaylist: s.setPlaylist,
    })),
  );
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);
  const { openImages, isActive } = openImagesStore(
    useShallow((s) => ({
      openImages: s.openImages,
      isActive: s.isActive,
    })),
  );
  useSetLastActivePlaylist();
  const isFirstRender = useRef(true);

  const handleClickAddImages = (action: openFileAction) => {
    void openImages({ action });
  };

  const reorderSortingCriteria = useCallback(() => {
    const currentImages = usePlaylistStore.getState().playlist.images;
    const newArray = [...currentImages].sort((a: PlaylistImage, b: PlaylistImage) => {
      if (a.time == null || b.time == null) return 0;
      return a.time - b.time;
    });
    movePlaylistArrayOrder(newArray);
  }, [movePlaylistArrayOrder]);

  const lastIndex = playlist.images.length - 1;
  const playlistArray = playlist.images.map((img, index) => {
    const isLast =
      playlist.configuration.type === "time_of_day"
        ? lastAddedImageID === img.image_id
        : index === lastIndex;
    return (
      <MiniPlaylistCard
        key={img.image_id}
        isLast={isLast}
        reorderSortingCriteria={reorderSortingCriteria}
        type={playlist.configuration.type}
        index={index}
        playlistImage={img}
      />
    );
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (playlist.images.length === 0) {
      clearPlaylist();
    }
  }, [playlist.images, clearPlaylist]);

  useEffect(() => {
    const dispose = goDaemon.on("playlists_updated", () => {
      if (playlist.id) {
        goDaemon.getPlaylist(playlist.id).then((fullPlaylist) => {
          if (fullPlaylist) {
            setPlaylist({
              id: fullPlaylist.id,
              name: fullPlaylist.name,
              configuration: fullPlaylist.configuration,
              images: fullPlaylist.images,
            });
            void useImagesStore
              .getState()
              .fetchMissingImages(fullPlaylist.images.map((img) => img.image_id));
          }
        });
      }
    });
    return dispose;
  }, [playlist.id, setPlaylist]);

  useEffect(() => {
    if (playlist.configuration.type === "time_of_day") {
      reorderSortingCriteria();
    }
  }, [playlist.configuration.type, reorderSortingCriteria]);

  const imagesMap = useImagesStore((s) => s.imagesMap);
  useEffect(() => {
    if (playlist.images.length === 0) return;
    const missing = playlist.images.filter((img) => !imagesMap.has(img.image_id));
    if (missing.length > 0) {
      void useImagesStore.getState().fetchMissingImages(missing.map((img) => img.image_id));
    }
  }, [playlist.images, imagesMap]);

  const isNeo = useIsNeo();

  const dropData = useMemo<DropTargetData>(() => ({ type: "playlist" }), []);
  const { ref: playlistDropRef, isDropTarget } = useDroppable({
    id: "playlist-drop",
    data: dropData,
  });

  const isDraggingAddable = useDragStore(
    (s) => s.isDragging && (s.dragType === "image" || s.dragType === "folder"),
  );
  const showDropIndicator = isDropTarget && isDraggingAddable;

  const btnClass = isNeo ? "btn btn-primary uppercase" : "btn btn-primary rounded-lg uppercase";
  const scrollClass =
    playlistArray.length > 0
      ? isNeo
        ? "neo-playlist-scroll overflow-y-hidden overflow-x-scroll scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm"
        : "overflow-y-hidden overflow-x-scroll scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm rounded-lg"
      : "";

  return (
    <div className="mb-2 flex w-full min-w-0 flex-col gap-5 overflow-x-clip">
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <div className="flex w-full min-w-0 flex-col">
          <span className="text-2xl lg:text-4xl font-bold truncate">
            {playlistArray.length > 0 ? `Playlist (${playlistArray.length})` : "Playlist"}
            {isDirty && (
              <span
                className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-warning align-middle"
                title="Unsaved changes"
              />
            )}
          </span>
        </div>
        <div className="dropdown dropdown-top">
          <button type="button" tabIndex={0} className={btnClass}>
            Add images
          </button>
          <ul className="menu dropdown-content z-10 mb-1 w-52 bg-base-100 p-2 shadow-sm">
            <li>
              <button
                type="button"
                className="text-lg text-base-content"
                onMouseDown={isActive ? undefined : () => handleClickAddImages("file")}
              >
                Individual images
              </button>
            </li>
            <li>
              <button
                type="button"
                className="text-lg text-base-content"
                onMouseDown={isActive ? undefined : () => handleClickAddImages("folder")}
              >
                Media directory
              </button>
            </li>
            <li>
              <button
                type="button"
                className="text-lg text-base-content"
                onMouseDown={isActive ? undefined : () => handleClickAddImages("video")}
              >
                Videos
              </button>
            </li>
            <li>
              <button
                type="button"
                className="text-lg text-base-content"
                onMouseDown={isActive ? undefined : () => handleClickAddImages("web")}
              >
                Web wallpaper
              </button>
            </li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => {
            useModalStore.getState().open("LoadPlaylistModal");
          }}
          className={btnClass}
        >
          Load Playlist
        </button>
        <button
          type="button"
          onClick={() => {
            const monitor =
              monitorSelection.selectedMonitors.length === 1
                ? monitorSelection.selectedMonitors[0]
                : "*";
            goDaemon.setRandomWallpaper(monitor, monitorSelection.mode);
          }}
          className={btnClass}
        >
          Random Image
        </button>

        {playlist.images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => {
                useModalStore.getState().open("savePlaylistModal");
              }}
              className={isDirty ? `${btnClass} btn-warning animate-pulse` : btnClass}
            >
              {isDirty ? "Save*" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                useModalStore.getState().open("playlistConfigurationModal");
              }}
              className={btnClass}
            >
              Configure
            </button>
            <button
              type="button"
              className={isNeo ? "btn btn-error uppercase" : "btn btn-error rounded-lg uppercase"}
              onClick={async () => {
                if (playlist.id) {
                  await stopPlaylistSilent(playlist.id);
                }
                clearPlaylist();
                useActivePlaylistStore.getState().clear();
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
      <div
        ref={playlistDropRef}
        className={`relative flex w-full min-h-[4.5rem] ${scrollClass} transition-all duration-200${showDropIndicator ? " ring-2 ring-dashed ring-primary bg-primary/10" : ""}`}
      >
        {showDropIndicator && playlistArray.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary">Drop to add to playlist</span>
          </div>
        )}
        {playlistArray}
      </div>
    </div>
  );
}

export default PlaylistTrack;
