import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { LayoutGroup, m } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import openImagesStore from "../hooks/useOpenImages";
import { useShallow } from "zustand/react/shallow";

import { useMonitorStore } from "../stores/monitors";
import type { openFileAction } from "../../shared/types";
import type { PLAYLIST_TYPES_TYPE } from "../../shared/types/playlist";
import { useSetLastActivePlaylist } from "../hooks/useSetLastActivePlaylist";
import { useViewportCompactHeight } from "../hooks/useViewportCompactHeight";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import { useDragStore } from "../stores/dragStore";
import type { DropTargetData } from "../stores/dragStore";
import { useModalStore } from "../stores/modalStore";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { miniPlaylistStripTileWidths } from "../utils/playlistMiniCardLayout";
import { playlistGalleryDragAddsImages } from "../utils/playlistGalleryDrag";

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

/** Opening gap in the strip while dragging gallery/folder — mirrors sortable shift timing (see MiniPlaylistCard layout). */
function PlaylistGalleryInsertionGhost({
  viewportCompact,
  playlistType,
}: {
  viewportCompact: boolean;
  playlistType: PLAYLIST_TYPES_TYPE;
}) {
  const widths = miniPlaylistStripTileWidths(viewportCompact);
  const needsCaptionSpace = playlistType === "time_of_day" || playlistType === "day_of_week";

  return (
    <m.div
      layout
      transition={{
        layout: {
          duration: 0.25,
          ease: [0.25, 1, 0.5, 1],
        },
      }}
      className="shrink-0 self-end"
    >
      <div className={cn("mx-1 mb-2 flex flex-col justify-end", widths)}>
        <div
          className={cn(
            "aspect-[3/2] w-full border-2 border-dashed border-primary/60 bg-primary/10 shadow-inner",
            "rounded-[var(--wp-radius-sm)] border-[var(--wp-border-color)]",
          )}
          aria-hidden
        />
        {needsCaptionSpace ? <div className="h-9 min-h-[2.25rem] shrink-0" aria-hidden /> : null}
      </div>
    </m.div>
  );
}

function PlaylistAppendTailDropZone({ insertIndex }: { insertIndex: number }) {
  const appendTailDisabled = useDragStore((s) => {
    if (!s.isDragging) return true;
    if (s.dragType === "playlist-item") return true;
    if (s.dragType === "image" || s.dragType === "folder") {
      return !playlistGalleryDragAddsImages(s.dragType, s.dragIds);
    }
    return true;
  });
  const dropData = useMemo<DropTargetData>(
    () => ({ type: "playlist-item", insertIndex }),
    [insertIndex],
  );
  const { ref } = useDroppable({
    id: "playlist-append-tail",
    data: dropData,
    /** Prefer this zone over strip tiles when dropping gallery/folder (cards stay Normal). */
    collisionPriority: CollisionPriority.High,
    disabled: appendTailDisabled,
  });
  return (
    <div
      ref={ref}
      className="min-h-[5rem] min-w-[72px] grow shrink-0 basis-[72px] self-end"
      aria-hidden
    />
  );
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
  const viewportCompact = useViewportCompactHeight();
  const isFirstRender = useRef(true);

  const handleClickAddImages = (action: openFileAction) => {
    void openImages({ action });
  };

  const reorderSortingCriteria = useCallback(() => {
    const currentImages = usePlaylistStore.getState().playlist.images;
    const newArray = currentImages.toSorted((a: PlaylistImage, b: PlaylistImage) => {
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

  const playlistGalleryInsertPreviewAt = useDragStore((s) =>
    s.isDragging && (s.dragType === "image" || s.dragType === "folder")
      ? (s.overDropTarget?.playlistInsertPreviewAt ?? null)
      : null,
  );

  const playlistStripChildren = useMemo(() => {
    const len = playlist.images.length;
    const lastIdx = len - 1;
    const rows: ReactNode[] = [];
    playlist.images.forEach((img, index) => {
      if (playlistGalleryInsertPreviewAt === index) {
        rows.push(
          <PlaylistGalleryInsertionGhost
            key={`gallery-drop-insert-before-${img.image_id}`}
            viewportCompact={viewportCompact}
            playlistType={playlist.configuration.type}
          />,
        );
      }
      const isLast =
        playlist.configuration.type === "time_of_day"
          ? lastAddedImageID === img.image_id
          : index === lastIdx;
      const isCurrentTrack =
        isThisPlaylistActive && activePlaylist?.current_image_id === img.image_id;
      rows.push(
        <MiniPlaylistCard
          key={img.image_id}
          isLast={isLast}
          reorderSortingCriteria={reorderSortingCriteria}
          type={playlist.configuration.type}
          index={index}
          playlistImage={img}
          isCurrentTrack={isCurrentTrack}
          viewportCompact={viewportCompact}
        />,
      );
    });
    if (playlistGalleryInsertPreviewAt === len && len > 0) {
      rows.push(
        <PlaylistGalleryInsertionGhost
          key="gallery-drop-insert-end"
          viewportCompact={viewportCompact}
          playlistType={playlist.configuration.type}
        />,
      );
    }
    return rows;
  }, [
    playlist.images,
    playlist.configuration.type,
    playlistGalleryInsertPreviewAt,
    viewportCompact,
    reorderSortingCriteria,
    isThisPlaylistActive,
    activePlaylist?.current_image_id,
    lastAddedImageID,
  ]);

  const dropData = useMemo<DropTargetData>(() => ({ type: "playlist" }), []);
  const { ref: playlistDropRef, isDropTarget } = useDroppable({
    id: "playlist-drop",
    data: dropData,
    /** Let per-card sortable targets win so reorder resolves to `playlist-item`, not this strip. */
    collisionPriority: CollisionPriority.Lowest,
  });

  const showGalleryPlaylistDropChrome = useDragStore(
    (s) =>
      s.isDragging &&
      (s.dragType === "image" || s.dragType === "folder") &&
      playlistGalleryDragAddsImages(s.dragType, s.dragIds),
  );
  const showDropIndicator = isDropTarget && showGalleryPlaylistDropChrome;

  const btnClass = viewportCompact
    ? "btn btn-xs btn-primary rounded-[var(--wp-radius-md)] uppercase"
    : "btn btn-sm btn-primary rounded-[var(--wp-radius-md)] uppercase";
  /* Horizontal scroll lives on a block wrapper — do NOT use flex + items-end on that same node:
   * when a horizontal scrollbar appears it shrinks the scrollport height and flex-end shifts every
   * card upward (vertical jump). Inner row handles alignment; outer only scrolls on X.
   * overflow-x-scroll keeps the scrollbar lane allocated on classic scrollbars (stable footprint).
   * Never combine overflow-y-hidden here: it clips translateY + shadows on the “raised” card. */
  const trackScrollOuterClass =
    playlist.images.length > 0
      ? cn(
          "neo-playlist-scroll min-w-0 w-full overflow-x-scroll overflow-y-visible [scrollbar-gutter:stable]",
          "rounded-[var(--wp-radius-md)] scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm",
          "pt-3 pb-1 [@media(max-height:1080px)]:pt-2 [@media(max-height:1080px)]:pb-0.5",
        )
      : "";

  const editCardClass = cn(
    "flex flex-col gap-3 [@media(max-height:1080px)]:gap-2",
    "neo-playlist-toolbar",
    "rounded-[var(--wp-radius-lg)] border border-base-content/10 bg-base-100/60 p-3 shadow-sm backdrop-blur-[2px] [@media(max-height:1080px)]:p-2",
  );

  const dangerBtnClass = viewportCompact
    ? "btn btn-xs btn-error rounded-[var(--wp-radius-md)] uppercase"
    : "btn btn-sm btn-error rounded-[var(--wp-radius-md)] uppercase";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col overflow-x-clip overflow-y-visible",
        "gap-3 px-3 py-3 [@media(max-height:1080px)]:gap-2 [@media(max-height:1080px)]:px-2 [@media(max-height:1080px)]:py-2",
      )}
    >
      {isThisPlaylistActive && <PlaylistController />}

      <div className={editCardClass}>
        <div className="flex w-full min-w-0 items-center justify-between gap-3 [@media(max-height:1080px)]:gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[0.6rem] font-[family-name:var(--font-display)] font-semibold uppercase tracking-[0.18em] text-base-content/50">
              Edit Track
            </span>
            <span className="truncate text-lg font-bold font-[family-name:var(--font-display)] uppercase tracking-tight text-base-content lg:text-xl [@media(max-height:1080px)]:text-base [@media(max-height:1080px)]:lg:text-lg">
              {playlist.images.length > 0
                ? `${playlist.name?.trim() || "Unnamed Playlist"} (${playlist.images.length})`
                : ""}
            </span>
            {isDirty && (
              <span
                className="inline-block size-2.5 shrink-0 rounded-full bg-warning"
                title="Unsaved changes"
                aria-label="Unsaved changes"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 [@media(max-height:1080px)]:gap-2">
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
        className={`relative w-full min-w-0 overflow-visible transition-all duration-200 rounded-[var(--wp-radius-md)]${
          playlist.images.length === 0 && showGalleryPlaylistDropChrome ? " min-h-[5.5rem]" : ""
        }${showDropIndicator ? " ring-2 ring-dashed ring-primary bg-primary/10" : ""}`}
      >
        {showDropIndicator && playlist.images.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary">Drop to add to playlist</span>
          </div>
        )}
        <div
          ref={trackScrollRef}
          style={playlist.images.length > 0 ? { scrollbarGutter: "stable" } : undefined}
          className={cn("w-full min-w-0", trackScrollOuterClass)}
        >
          {playlist.images.length > 0 ? (
            <div className="flex min-w-full items-end">
              <LayoutGroup
                id={playlist.id != null ? `playlist-strip-${playlist.id}` : "playlist-strip-local"}
              >
                <div className="flex min-w-min items-end">{playlistStripChildren}</div>
              </LayoutGroup>
              <PlaylistAppendTailDropZone insertIndex={playlist.images.length} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PlaylistTrack;
