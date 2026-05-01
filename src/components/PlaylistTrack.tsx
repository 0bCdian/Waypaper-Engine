import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
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

import MiniPlaylistCard from "./MiniPlaylistCard";
import PlaylistController from "./PlaylistController";
import { daemonClient } from "@/client";

async function stopPlaylistSilent(playlistId: number) {
  try {
    await daemonClient.stopPlaylist(playlistId);
  } catch (error) {
    console.error(error);
  }
}

function PlaylistTrack() {
  const {
    playlist,
    lastAddedImageID,
    isDirty,
    stripScrollToImageIdOnce,
    clearStripScrollIntent,
    movePlaylistArrayOrder,
    clearPlaylist,
    setPlaylist,
  } = usePlaylistStore(
    useShallow((s) => ({
      playlist: s.playlist,
      lastAddedImageID: s.lastAddedImageID,
      isDirty: s.isDirty,
      stripScrollToImageIdOnce: s.stripScrollToImageIdOnce,
      clearStripScrollIntent: s.clearStripScrollIntent,
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

  const activePlaylist = useActivePlaylistStore((s) => s.activePlaylist);
  const isThisPlaylistActive =
    activePlaylist != null && playlist.id != null && activePlaylist.playlist_id === playlist.id;

  const playlistImageIdsKey = useMemo(
    () => playlist.images.map((i) => i.image_id).join(),
    [playlist.images],
  );

  const trackScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  /** After a user append scroll, skip the follow-up effect pass that would scroll to the active slot. */
  const skipNextActiveStripScrollRef = useRef(false);

  useLayoutEffect(() => {
    const root = trackScrollRef.current;
    if (!root) {
      return;
    }
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;

      if (skipNextActiveStripScrollRef.current) {
        skipNextActiveStripScrollRef.current = false;
        return;
      }

      const oneShot = usePlaylistStore.getState().stripScrollToImageIdOnce;
      if (oneShot != null) {
        const el = root.querySelector<HTMLElement>(`[data-playlist-image-id="${String(oneShot)}"]`);
        if (el) {
          el.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "smooth",
          });
        }
        clearStripScrollIntent();
        skipNextActiveStripScrollRef.current = true;
        return;
      }

      if (!isThisPlaylistActive || !activePlaylist) {
        return;
      }
      const activeEl = root.querySelector<HTMLElement>('[data-active-playlist-item="true"]');
      if (!activeEl) {
        return;
      }
      activeEl.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
      activeEl.focus({ preventScroll: true });
    });
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [
    stripScrollToImageIdOnce,
    isThisPlaylistActive,
    activePlaylist?.playlist_id,
    activePlaylist?.current_image_id,
    activePlaylist?.current_index,
    activePlaylist?.paused,
    playlistImageIdsKey,
    clearStripScrollIntent,
  ]);

  const lastIndex = playlist.images.length - 1;
  const playlistArray = playlist.images.map((img, index) => {
    const isLast =
      playlist.configuration.type === "time_of_day"
        ? lastAddedImageID === img.image_id
        : index === lastIndex;
    const isCurrentTrack =
      isThisPlaylistActive && activePlaylist?.current_image_id === img.image_id;
    return (
      <MiniPlaylistCard
        key={img.image_id}
        isLast={isLast}
        reorderSortingCriteria={reorderSortingCriteria}
        type={playlist.configuration.type}
        index={index}
        playlistImage={img}
        isCurrentTrack={isCurrentTrack}
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
    const dispose = daemonClient.on("gallery_changed", (data: unknown) => {
      const payload = data as { domain?: string };
      if (payload?.domain !== "playlists") return;
      if (playlist.id) {
        daemonClient.getPlaylist(playlist.id).then((fullPlaylist) => {
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
    /** Let per-card sortable targets win so reorder resolves to `playlist-item`, not this strip. */
    collisionPriority: CollisionPriority.Lowest,
  });

  const isDraggingAddable = useDragStore(
    (s) => s.isDragging && (s.dragType === "image" || s.dragType === "folder"),
  );
  const showDropIndicator = isDropTarget && isDraggingAddable;

  const btnClass = isNeo
    ? "btn btn-sm btn-primary uppercase"
    : "btn btn-sm btn-primary rounded-lg uppercase";
  /* Horizontal scroll only (Tailwind / DaisyUI pattern: overflow-x-auto on flex row).
   * Never combine overflow-y-hidden here: it clips translateY + shadows on the “raised” card. */
  const scrollClass =
    playlistArray.length > 0
      ? isNeo
        ? "neo-playlist-scroll flex min-w-0 overflow-x-auto scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm"
        : "flex min-w-0 overflow-x-auto rounded-lg pt-3 pb-1 scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm"
      : "";

  const editCardClass = cn(
    "flex flex-col gap-3",
    isNeo && "neo-playlist-toolbar",
    !isNeo &&
      "rounded-xl border border-base-content/10 bg-base-100/60 p-3 shadow-sm backdrop-blur-[2px]",
  );

  const dangerBtnClass = isNeo
    ? "btn btn-sm btn-error uppercase"
    : "btn btn-sm btn-error rounded-lg uppercase";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 overflow-x-clip overflow-y-visible px-3 py-3">
      {isThisPlaylistActive && <PlaylistController />}

      <div className={editCardClass}>
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-base-content/50",
                isNeo && "font-[family-name:var(--font-display)]",
              )}
            >
              Edit Track
            </span>
            <span
              className={cn(
                "truncate text-lg font-bold lg:text-xl",
                isNeo &&
                  "font-[family-name:var(--font-display)] uppercase tracking-tight text-base-content",
              )}
            >
              {playlistArray.length > 0
                ? `${playlist.name?.trim() || "Unnamed Playlist"} (${playlistArray.length})`
                : ""}
            </span>
            {isDirty && (
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-warning"
                title="Unsaved changes"
                aria-label="Unsaved changes"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                daemonClient.setRandomWallpaper(monitor, monitorSelection.mode);
              }}
              className={btnClass}
            >
              Random Image
            </button>
          </div>

          {playlist.images.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
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
                className={dangerBtnClass}
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
            </div>
          )}
        </div>
      </div>

      <div
        ref={playlistDropRef}
        className={`relative w-full min-w-0 overflow-visible transition-all duration-200 rounded-lg${
          playlistArray.length === 0 && showDropIndicator ? " min-h-[5.5rem]" : ""
        }${showDropIndicator ? " ring-2 ring-dashed ring-primary bg-primary/10" : ""}`}
      >
        {showDropIndicator && playlistArray.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary">Drop to add to playlist</span>
          </div>
        )}
        <div ref={trackScrollRef} className={`w-full min-w-0 items-end ${scrollClass}`}>
          {playlistArray}
        </div>
      </div>
    </div>
  );
}

export default PlaylistTrack;
