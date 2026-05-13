import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";
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
import { daemonClient } from "@/client";
import { Card } from "./ui/Card";

interface ImageCardProps {
  Image: rendererImage;
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
  const overlayId = useId();
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);
  const {
    addImagesToPlaylist: addImageToPlaylist,
    readPlaylist,
    removeImagesFromPlaylist: removeImageFromPlaylist,
    isEmpty,
    playlistImagesSet: imagesInPlaylist,
  } = usePlaylistStore(
    useShallow((s) => ({
      addImagesToPlaylist: s.addImagesToPlaylist,
      readPlaylist: s.readPlaylist,
      removeImagesFromPlaylist: s.removeImagesFromPlaylist,
      isEmpty: s.isEmpty,
      playlistImagesSet: s.playlistImagesSet,
    })),
  );
  const { addToSelectedImages, removeFromSelectedImages, selectedImages } = useImagesStore(
    useShallow((s) => ({
      addToSelectedImages: s.addToSelectedImages,
      removeFromSelectedImages: s.removeFromSelectedImages,
      selectedImages: s.selectedImages,
    })),
  );

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

  const isChecked = !isEmpty && imagesInPlaylist.has(Image.id);
  const isSelected = selectedImages.has(Image.id);

  const dragData = useMemo<DragSourceData>(() => {
    const ids = isSelected ? Array.from(selectedImages) : [Image.id];
    return { type: "image", imageId: Image.id, selectedIds: ids };
  }, [Image.id, isSelected, selectedImages]);

  const { ref: dragRef, isDragging } = useDraggable({
    id: `image-${Image.id}`,
    data: dragData,
  });

  const handleDoubleClick = () => {
    if (!Image.id) {
      logger.error("Cannot set image - missing id", { Image });
      return;
    }

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

    if (checked) {
      const playlist = readPlaylist();
      if (playlist.configuration.type === "day_of_week" && playlist.images.length >= 7) {
        return;
      }
      addImageToPlaylist([Image.id]);
    } else {
      removeImageFromPlaylist(new Set([Image.id]));
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const multi = isHotkeyPressed("mod") || e.metaKey || e.ctrlKey;
    if (multi) {
      if (isSelected) {
        removeFromSelectedImages(Image);
      } else {
        addToSelectedImages(Image);
      }
    }
  };

  const openContextMenu = useContextMenuStore((s) => s.open);
  const monitorsList = useMonitorStore((s) => s.monitorsList);

  const handleRightClick = (e: React.MouseEvent) => {
    const items = buildImageMenuItems(Image, monitorsList, selectedImages.size);
    openContextMenu(e, items);
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
  const daemonImage = Image as unknown as import("../../electron/daemon-go-types").Image;
  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDetail(daemonImage);
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

  const [isHovered, setIsHovered] = useState(false);

  const rasterClass = isPolaroid
    ? "w-full h-auto aspect-[3/2] object-cover block"
    : "transform-gpu rounded-lg transition-all duration-300 group-hover/card:scale-105 group-hover/card:object-center w-full h-auto aspect-[3/2] object-cover";

  const pictureWrapClass = isPolaroid ? "neo-polaroid-image" : "block size-full";

  const videoPoster = Image.thumbnails?.default?.trim() || undefined;
  /**
   * Use mouse enter/leave (not pointer) so preview playback isn’t disrupted by drag-and-drop
   * pointer capture. Invisible caption bars use pointer-events-none until the card is hovered.
   */
  const videoCardHoverHandlers = {
    onMouseEnter: () => {
      setIsHovered(true);
      if (isVideo || webVideoPreview) {
        cancelVideoHoverPlayRef.current?.();
        const v = videoRef.current;
        if (!v) return;
        cancelVideoHoverPlayRef.current = playMutedVideoWhenReady(v);
      }
    },
    onMouseLeave: () => {
      setIsHovered(false);
      if (isVideo || webVideoPreview) {
        cancelVideoHoverPlayRef.current?.();
        cancelVideoHoverPlayRef.current = null;
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.currentTime = 0;
        }
      }
    },
  };

  const rasterImgSrc = imgBroken
    ? TRANSPARENT_PIXEL
    : isGifPreview
      ? Image.path
      : webAnimatedPreview
        ? Image.preview_path?.trim() || Image.thumbnails?.default?.trim() || TRANSPARENT_PIXEL
        : isWeb
          ? Image.thumbnails?.default?.trim() || TRANSPARENT_PIXEL
          : Image.thumbnails?.default?.trim() || Image.path;

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
      currentTarget.src = Image.path;
      return;
    }
    setImgBroken(true);
  };

  const mediaPreview =
    isVideo || webVideoPreview ? (
      isPolaroid ? (
        <div className={pictureWrapClass}>
          <video
            ref={videoRef}
            className={rasterClass}
            style={{ transform: isHovered ? "scale(1.03)" : "scale(1)" }}
            src={isVideo ? nativeVideoSrc : (Image.preview_path ?? "")}
            poster={videoPoster}
            muted
            loop
            playsInline
            preload="auto"
            aria-label={Image.name}
            onError={handleVideoDebugError}
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          className={rasterClass}
          style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
          src={isVideo ? nativeVideoSrc : (Image.preview_path ?? "")}
          poster={videoPoster}
          muted
          loop
          playsInline
          preload="auto"
          aria-label={Image.name}
          onError={handleVideoDebugError}
        />
      )
    ) : webAnimatedPreview ? (
      // Skip <picture> (single raster src). Polaroid needs .neo-polaroid-image for neobrutalist.css hover.
      // Default: same <img className={rasterClass}> as standalone GIF tiles — group-hover:scale on the img works there.
      isPolaroid ? (
        <div className={pictureWrapClass}>
          <img
            ref={imgRef}
            className={rasterClass}
            style={{ transform: isHovered ? "scale(1.03)" : "scale(1)" }}
            src={rasterImgSrc}
            alt={Image.name}
            draggable={false}
            loading="lazy"
            onError={onRasterImgError}
          />
        </div>
      ) : (
        <picture className={pictureWrapClass}>
          <img
            ref={imgRef}
            className={rasterClass}
            style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
            src={rasterImgSrc}
            alt={Image.name}
            draggable={false}
            loading="lazy"
            onError={onRasterImgError}
          />
        </picture>
      )
    ) : (
      <picture className={pictureWrapClass}>
        {useThumbSources && Image.thumbnails?.["4k"]?.trim() && (
          <source media="(width >= 7680px)" srcSet={Image.thumbnails["4k"]} />
        )}
        {useThumbSources && Image.thumbnails?.["1440p"]?.trim() && (
          <source media="(width >= 2560px)" srcSet={Image.thumbnails["1440p"]} />
        )}
        {useThumbSources && Image.thumbnails?.["1080p"]?.trim() && (
          <source media="(width >= 720px)" srcSet={Image.thumbnails["1080p"]} />
        )}
        {useThumbSources && Image.thumbnails?.["720p"]?.trim() && (
          <source media="(width >= 300px)" srcSet={Image.thumbnails["720p"]} />
        )}
        {useThumbSources && Image.thumbnails?.default?.trim() && (
          <source media="(width < 720px)" srcSet={Image.thumbnails.default} />
        )}
        <img
          ref={imgRef}
          className={rasterClass}
          style={{
            transform: isHovered ? (isPolaroid ? "scale(1.03)" : "scale(1.05)") : "scale(1)",
          }}
          src={rasterImgSrc}
          alt={Image.name}
          draggable={false}
          loading="lazy"
          onError={onRasterImgError}
        />
      </picture>
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
        onClick={handleClick}
        className={`neo-polaroid group relative w-full animate-fade-in${isDragging ? " opacity-50" : ""}`}
      >
        <input
          checked={isChecked}
          id={Image.name}
          onChange={handleCheckboxChange}
          type="checkbox"
          className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-xs opacity-0 checked:opacity-100 group-hover:opacity-100"
        />
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
          {isVideo && durationLabel && (
            <div className="pointer-events-none absolute right-2 bottom-2 z-20 rounded bg-base-content/70 px-1.5 py-0.5 text-[10px] font-semibold text-base-100">
              {durationLabel}
            </div>
          )}
          <div className="neo-polaroid-caption pointer-events-none group-hover:pointer-events-auto relative z-20">
            {isRenaming ? (
              renameInput
            ) : (
              <p
                className="neo-polaroid-name"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename();
                }}
              >
                {Image.name}
                {Image.format && (
                  <span className="ml-1.5 inline-block rounded bg-base-300/80 px-1 py-0.5 align-middle text-[0.6rem] font-semibold uppercase leading-none text-base-content/70">
                    {Image.format}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div
          data-selected={isSelected}
          id={overlayId}
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
      onClick={handleClick}
      className={`group relative w-full overflow-hidden rounded-lg duration-200 animate-fade-in${isDragging ? " opacity-50" : ""}`}
    >
      <input
        checked={isChecked}
        id={Image.name}
        onChange={handleCheckboxChange}
        type="checkbox"
        className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-xs opacity-0 checked:opacity-100 group-hover:opacity-100"
      />
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
        {isVideo && durationLabel && (
          <div className="pointer-events-none absolute right-2 bottom-2 z-20 rounded bg-base-content/70 px-1.5 py-0.5 text-[10px] font-semibold text-base-100">
            {durationLabel}
          </div>
        )}
        <div className="pointer-events-none group-hover:pointer-events-auto absolute bottom-0 z-20 w-full bg-base-content/75 p-2 pl-2 opacity-0 transition-all duration-300 group-hover:opacity-100 text-base-100">
          {isRenaming ? (
            renameInput
          ) : (
            <p
              className="w-full overflow-hidden truncate text-ellipsis text-justify text-lg font-medium"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              {Image.name}
              {Image.format && (
                <span className="ml-1.5 inline-block rounded bg-base-100/20 px-1 py-0.5 align-middle text-[0.6rem] font-semibold uppercase leading-none">
                  {Image.format}
                </span>
              )}
            </p>
          )}
        </div>
        <div
          data-selected={isSelected}
          id={overlayId}
          className="absolute top-0 z-10 size-full bg-primary opacity-0 transition-all data-[selected=true]:opacity-45 pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}

export default ImageCard;
