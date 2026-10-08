import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useDraggable } from "@dnd-kit/react";
import { useImagesStore } from "../stores/images";
import type { rendererImage } from "../types/rendererTypes";
import { useMonitorStore } from "../stores/monitors";
import { usePlaylistStore } from "../stores/playlist";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useToastStore } from "../stores/toastStore";
import { buildImageMenuItems } from "../utils/contextMenuItems";
import { webPreviewPlaybackKind } from "../utils/webPreviewPlayback";
import { playMutedVideoWhenReady } from "../utils/videoPreview";
import { useInlineRename } from "../hooks/useInlineRename";
import { notifyWallpaperApplyFailed } from "../utils/daemonUserFacingError";
import { logger } from "../utils/logger";
import type { DragSourceData } from "../stores/dragStore";
import type { Image as DaemonImage } from "../../electron/daemon-go-types";
import { daemonClient } from "@/client";
import { Card } from "./ui/Card";

interface ImageCardProps {
  Image: rendererImage;
}

// Card width per grid breakpoint in PaginatedGallery; lets the browser pick the smallest adequate thumbnail.
const THUMB_SIZES =
  "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw";

function thumbSrcSet(thumbs: rendererImage["thumbnails"]): string | undefined {
  const candidates = [
    [thumbs?.default, 300],
    [thumbs?.["720p"], 1280],
    [thumbs?.["1080p"], 1920],
  ] as const;
  const set = candidates
    .filter(([url]) => url?.trim())
    .map(([url, w]) => `${url} ${w}w`)
    .join(", ");
  return set || undefined;
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function ImageCard({ Image }: ImageCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelVideoHoverPlayRef = useRef<(() => void) | null>(null);
  const imgErrorCountRef = useRef(0);
  const ensurePreviewOnceRef = useRef(false);
  const [imgBroken, setImgBroken] = useState(false);
  const isChecked = usePlaylistStore((s) => !s.isEmpty && s.playlistImagesSet.has(Image.id));
  const isSelected = useImagesStore((s) => s.selectedImages.has(Image.id));

  const isPolaroid = useDesignSystemStore(
    (s) => s.designMode === "neobrutalist" && s.neoConfig.polaroidCards,
  );
  const addToast = useToastStore((s) => s.addToast);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      try {
        const updated = await useImagesStore.getState().renameImage(Image.id, newName);
        if (updated.name !== newName) {
          addToast(`Renamed to "${updated.name}" (original name was taken)`, "info", 3000);
        } else {
          addToast("Image renamed", "success", 2000);
        }
      } catch {
        addToast("Failed to rename image", "error");
      }
    },
    [Image.id, addToast],
  );

  const {
    isRenaming,
    renameName,
    setRenameName,
    renameInputRef,
    startRename,
    submitRename,
    cancelRename,
  } = useInlineRename({
    currentName: Image.name,
    onSubmit: handleRenameSubmit,
  });

  const dragData = useMemo<DragSourceData>(
    () => ({ type: "image", imageId: Image.id }),
    [Image.id],
  );

  const { ref: dragRef, isDragging } = useDraggable({
    id: `image-${Image.id}`,
    data: dragData,
  });

  const handleDoubleClick = () => {
    if (!Image.id) {
      logger.error("Cannot set image - missing id", { Image });
      return;
    }

    const { monitorSelection } = useMonitorStore.getState();
    const monitor =
      monitorSelection.selectedMonitors.length === 1 ? monitorSelection.selectedMonitors[0] : "*";

    const media = (Image.media_type || "image").toLowerCase();
    const requestedMode = monitorSelection.mode;
    // Engine splits extend only for static raster "image"; gif/video/web use clone on the wire.
    const mode = requestedMode === "extend" && media !== "image" ? "clone" : requestedMode;
    if (requestedMode === "extend" && mode === "clone") {
      addToast(
        "Extend spans static images only. Using the same wallpaper on each display (clone).",
        "info",
        3200,
      );
    }
    void daemonClient.setWallpaper(Image.id, monitor, mode).catch(notifyWallpaperApplyFailed);
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const { checked } = event.currentTarget;

    const playlistStore = usePlaylistStore.getState();
    if (checked) {
      const playlist = playlistStore.readPlaylist();
      if (playlist.configuration.type === "day_of_week" && playlist.images.length >= 7) {
        return;
      }
      playlistStore.addImagesToPlaylist([Image.id]);
    } else {
      playlistStore.removeImagesFromPlaylist(new Set([Image.id]));
    }
  };

  const toggleImageSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const multi = isHotkeyPressed("mod") || e.metaKey || e.ctrlKey;
    if (multi) {
      const images = useImagesStore.getState();
      if (isSelected) {
        images.removeFromSelectedImages(Image);
      } else {
        images.addToSelectedImages(Image);
      }
    }
  };

  const openContextMenu = useContextMenuStore((s) => s.open);

  const handleRightClick = (e: React.MouseEvent) => {
    const { monitorsList } = useMonitorStore.getState();
    const { selectedImages } = useImagesStore.getState();
    openContextMenu(e, buildImageMenuItems(Image, monitorsList, selectedImages.size));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "F2") {
      e.preventDefault();
      startRename();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDoubleClick();
    }
  };

  const openDetail = useImageDetailStore((s) => s.open);
  useEffect(() => {
    ensurePreviewOnceRef.current = false;
  }, [Image.id]);
  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDetail(Image as unknown as DaemonImage);
  };
  const isGifPreview = Image.media_type === "gif" || Image.format?.toLowerCase() === "gif";
  const isVideo = Image.media_type === "video";
  const isWeb = Image.media_type === "web";
  const webPlaybackKind = isWeb ? webPreviewPlaybackKind(Image.preview_path) : null;
  const webVideoPreview = Boolean(isWeb && webPlaybackKind === "video");
  const webAnimatedPreview = Boolean(isWeb && webPlaybackKind === "animatedImage");
  const useThumbSources = !isGifPreview && !webAnimatedPreview;
  const durationLabel = formatDuration(Image.duration);
  /** H.264 proxy from daemon when source codec is not playable in Chromium (e.g. HEVC). */
  const nativeVideoSrc = Image.preview_path?.trim() || Image.path;

  const handleVideoDebugError = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      if (!isVideo || webVideoPreview) return;
      if (ensurePreviewOnceRef.current) return;
      const hasPreview = Boolean((Image.preview_path ?? "").trim());
      if (hasPreview) return;
      if (v.error?.code !== 4) return;
      ensurePreviewOnceRef.current = true;
      void (async () => {
        try {
          const updated = (await daemonClient.ensureBrowserPreview(
            Image.id,
            true,
          )) as rendererImage;
          if (updated.time === undefined) updated.time = null;
          useImagesStore.setState((s) => {
            const m = new Map(s.imagesMap);
            m.set(Image.id, updated);
            return {
              imagesMap: m,
              imagesArray: s.imagesArray.map((im) => (im.id === Image.id ? updated : im)),
            };
          });
        } catch (err) {
          ensurePreviewOnceRef.current = false;
          logger.warn("ensure browser preview failed", err);
        }
      })();
    },
    [Image.id, Image.preview_path, isVideo, webVideoPreview],
  );

  const renameInput = (
    <input
      ref={renameInputRef}
      type="text"
      className="input input-xs w-full bg-base-100 text-base-content font-medium"
      value={renameName}
      onChange={(e) => setRenameName(e.target.value)}
      onBlur={() => void submitRename()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          renameInputRef.current?.blur();
        } else if (e.key === "Escape") {
          cancelRename();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );

  const rasterClass = isPolaroid
    ? "w-full h-auto aspect-[3/2] object-cover block"
    : "block rounded-[var(--wp-radius-md)] transition-transform duration-300 group-hover/card:scale-105 w-full h-auto aspect-[3/2] object-cover";

  const videoPoster = Image.thumbnails?.default?.trim() || undefined;
  /**
   * Use mouse enter/leave (not pointer) so preview playback isn't disrupted by drag-and-drop
   * pointer capture. Invisible caption bars use pointer-events-none until the card is hovered.
   */
  const videoCardHoverHandlers =
    isVideo || webVideoPreview
      ? {
          onMouseEnter: () => {
            cancelVideoHoverPlayRef.current?.();
            const v = videoRef.current;
            if (!v) return;
            cancelVideoHoverPlayRef.current = playMutedVideoWhenReady(v);
          },
          onMouseLeave: () => {
            cancelVideoHoverPlayRef.current?.();
            cancelVideoHoverPlayRef.current = null;
            const v = videoRef.current;
            if (v) {
              v.pause();
              v.currentTime = 0;
            }
          },
        }
      : {};

  const rasterImgSrc = imgBroken
    ? TRANSPARENT_PIXEL
    : isGifPreview
      ? Image.path
      : webAnimatedPreview
        ? Image.preview_path?.trim() || Image.thumbnails?.default?.trim() || TRANSPARENT_PIXEL
        : isWeb
          ? Image.thumbnails?.default?.trim() || TRANSPARENT_PIXEL
          : Image.thumbnails?.default?.trim() || Image.path;
  const srcSet = useThumbSources && !imgBroken ? thumbSrcSet(Image.thumbnails) : undefined;

  const onRasterImgError = ({ currentTarget }: SyntheticEvent<HTMLImageElement>) => {
    if (webAnimatedPreview) {
      const thumb = Image.thumbnails?.default?.trim();
      if (thumb && currentTarget.src !== thumb) {
        currentTarget.src = thumb;
        return;
      }
      setImgBroken(true);
      return;
    }
    if (isWeb) {
      setImgBroken(true);
      return;
    }
    imgErrorCountRef.current++;
    if (imgErrorCountRef.current === 1 && Image.thumbnails?.default?.trim()) {
      currentTarget.removeAttribute("srcset");
      currentTarget.src = Image.path;
      return;
    }
    setImgBroken(true);
  };

  const media =
    isVideo || webVideoPreview ? (
      <video
        ref={videoRef}
        className={rasterClass}
        src={isVideo ? nativeVideoSrc : (Image.preview_path ?? "")}
        poster={videoPoster}
        muted
        loop
        playsInline
        preload={videoPoster ? "none" : "metadata"}
        aria-label={Image.name}
        onError={handleVideoDebugError}
      />
    ) : (
      <img
        ref={imgRef}
        className={rasterClass}
        src={rasterImgSrc}
        srcSet={srcSet}
        sizes={srcSet ? THUMB_SIZES : undefined}
        alt={Image.name}
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={onRasterImgError}
      />
    );
  // Polaroid hover zoom and sizing come from `.neo-polaroid-image` in neobrutalist.css.
  const mediaPreview = isPolaroid ? <div className="neo-polaroid-image">{media}</div> : media;

  const playlistCheckbox = (
    <input
      checked={isChecked}
      id={Image.name}
      onChange={handleCheckboxChange}
      type="checkbox"
      className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-xs opacity-0 checked:opacity-100 group-hover:opacity-100"
    />
  );

  const detailButton = (
    <button
      type="button"
      onClick={handleOpenDetail}
      className="btn btn-ghost btn-xs btn-square absolute left-2 top-2 z-20 opacity-0 group-hover:opacity-100"
      title="Edit details"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-4"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );

  const durationBadge = isVideo && durationLabel && (
    <div className="pointer-events-none absolute right-2 bottom-2 z-20 rounded bg-base-content/70 px-1.5 py-0.5 text-[10px] font-semibold text-base-100">
      {durationLabel}
    </div>
  );

  const caption = isRenaming ? (
    renameInput
  ) : (
    <p
      className={
        isPolaroid
          ? "neo-polaroid-name"
          : "w-full overflow-hidden truncate text-ellipsis text-justify text-lg font-medium"
      }
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- stopPropagation guard so click on the name doesn't activate the card
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startRename();
      }}
    >
      {Image.name}
      {Image.format && (
        <span
          className={`ml-1.5 inline-block rounded px-1 py-0.5 align-middle text-[0.6rem] font-semibold uppercase leading-none ${isPolaroid ? "bg-base-300/80" : "bg-base-100/20"}`}
          style={isPolaroid ? { color: "var(--wp-text-muted)" } : undefined}
        >
          {Image.format}
        </span>
      )}
    </p>
  );

  if (isPolaroid) {
    return (
      <Card
        ref={dragRef}
        polaroid={isPolaroid}
        elevation={0}
        data-gallery-image-root=""
        data-image-id={String(Image.id)}
        onContextMenu={handleRightClick}
        onClick={toggleImageSelection}
        className={`neo-polaroid group relative w-full animate-fade-in${isDragging ? " opacity-50" : ""}`}
      >
        {playlistCheckbox}
        {detailButton}
        <div
          role="button"
          tabIndex={0}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          className="group/card neo-polaroid-inner"
          aria-label={`Set ${Image.name} as wallpaper`}
          {...videoCardHoverHandlers}
        >
          {mediaPreview}
          {durationBadge}
          <div className="neo-polaroid-caption pointer-events-none group-hover:pointer-events-auto relative z-20">
            {caption}
          </div>
        </div>
        <div
          data-selected={isSelected}
          className="neo-polaroid-overlay pointer-events-none"
          aria-hidden="true"
        />
      </Card>
    );
  }

  return (
    <Card
      ref={dragRef}
      elevation={0}
      data-gallery-image-root=""
      data-image-id={String(Image.id)}
      onContextMenu={handleRightClick}
      onClick={toggleImageSelection}
      className={`group relative w-full overflow-hidden rounded-[var(--wp-radius-md)] duration-200 animate-fade-in${isDragging ? " opacity-50" : ""}`}
    >
      {playlistCheckbox}
      {detailButton}
      <div
        role="button"
        tabIndex={0}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        className="group/card relative size-full border-0 bg-transparent p-0 cursor-pointer"
        aria-label={`Set ${Image.name} as wallpaper`}
        {...videoCardHoverHandlers}
      >
        {mediaPreview}
        {durationBadge}
        <div className="pointer-events-none group-hover:pointer-events-auto absolute bottom-0 z-20 w-full bg-base-content/75 p-2 pl-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 text-base-100">
          {caption}
        </div>
        <div
          data-selected={isSelected}
          className="absolute top-0 z-10 size-full bg-primary opacity-0 transition-opacity data-[selected=true]:opacity-45 pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}

export default memo(ImageCard);
