import { useMemo, useState, type SyntheticEvent } from "react";
import type { Image, Monitor, MonitorMode } from "../../electron/daemon-go-types";
import { computeExtendCrop } from "../utils/extendCrop";
import { getThumbnailSrc } from "../utils/utilities";
import { webPreviewPlaybackKind } from "../utils/webPreviewPlayback";
import SvgComponent from "./AddImagesIcon";

interface Props {
  /** The image currently displayed on this monitor, or `null` when none. */
  image: Image | null;
  /** The mode the live wallpaper was applied in (never an editor selection). */
  mode: MonitorMode;
  monitor: Monitor;
  monitors: Monitor[];
  loading: boolean;
  /** Physical-pixel → preview-pixel scale used by the monitor rectangle. */
  scale: number;
}

type Resolved = { kind: "image"; src: string } | { kind: "video"; src: string } | { kind: "none" };

/** Picks the element and source that faithfully shows what the daemon renders. */
function resolveMedia(image: Image): Resolved {
  const isGif = image.media_type === "gif" || image.format?.toLowerCase() === "gif";
  if (isGif) return { kind: "image", src: image.path };
  if (image.media_type === "video") {
    return { kind: "video", src: image.preview_path?.trim() || image.path };
  }
  if (image.media_type === "web") {
    const playback = webPreviewPlaybackKind(image.preview_path);
    const preview = image.preview_path?.trim();
    if (playback === "video" && preview) return { kind: "video", src: preview };
    if (playback === "animatedImage" && preview) return { kind: "image", src: preview };
    const thumb = image.thumbnails?.default?.trim();
    return thumb ? { kind: "image", src: thumb } : { kind: "none" };
  }
  // Static image: use the real file so an extend split is 1:1 with the daemon.
  return { kind: "image", src: image.path };
}

/**
 * Faithfully renders the wallpaper currently on one monitor. It reads only live
 * daemon state — the editor's mode dropdown and monitor selection never reach
 * here. Static images in extend mode are split with the same geometry as
 * `daemon/internal/image/splitter.go`; video/gif/web are cloned (matching the
 * daemon, which only splits static images).
 */
export function WallpaperPreview({ image, mode, monitor, monitors, loading, scale }: Props) {
  const [imgBroken, setImgBroken] = useState(false);

  const resolved = useMemo<Resolved>(
    () => (image ? resolveMedia(image) : { kind: "none" }),
    [image],
  );

  // Extend split applies only to static images; the daemon clones everything else.
  const splitStyle = useMemo<React.CSSProperties | null>(() => {
    if (mode !== "extend" || !image || image.media_type !== "image") return null;
    if (resolved.kind !== "image") return null;
    const { bbox, crop } = computeExtendCrop(monitor, monitors);
    if (crop.w <= 0 || crop.h <= 0) return null;
    const previewPerLogical = (monitor.width * scale) / crop.w;
    return {
      position: "absolute",
      width: bbox.w * previewPerLogical,
      height: bbox.h * previewPerLogical,
      left: -crop.x * previewPerLogical,
      top: -crop.y * previewPerLogical,
      maxWidth: "none",
      objectFit: "cover",
    };
  }, [mode, image, resolved, monitor, monitors, scale]);

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center bg-base-200/50">
        <div className="text-center text-base-content/70">
          <div className="loading loading-spinner loading-md"></div>
          <p className="mt-2 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!image || resolved.kind === "none") {
    return (
      <div className="flex size-full items-center justify-center border-2 border-dashed border-base-300 bg-base-200/50">
        <div className="text-center text-base-content/70">
          <div className="mx-auto mb-2 size-12 opacity-50">
            <SvgComponent />
          </div>
          <p className="text-sm font-medium">{monitor.name}</p>
          <p className="text-xs opacity-75">
            {monitor.width}x{monitor.height}
          </p>
        </div>
      </div>
    );
  }

  if (resolved.kind === "video") {
    return (
      <video
        src={resolved.src}
        className="size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label={`Wallpaper on ${monitor.name}`}
      />
    );
  }

  // Fall back to a generated thumbnail if the full-resolution file fails to
  // load; the thumbnail is a same-aspect copy, so the split geometry is unchanged.
  const onError = ({ currentTarget }: SyntheticEvent<HTMLImageElement>) => {
    if (imgBroken) return;
    const thumb = getThumbnailSrc(image, "1080p").trim();
    if (thumb && thumb !== currentTarget.src) {
      currentTarget.src = thumb;
      return;
    }
    setImgBroken(true);
  };

  if (imgBroken) {
    return (
      <div className="flex size-full items-center justify-center border-2 border-dashed border-base-300 bg-base-200/50">
        <p className="text-sm font-medium text-base-content/70">{monitor.name}</p>
      </div>
    );
  }

  return (
    <img
      src={resolved.src}
      alt={`Wallpaper on ${monitor.name}`}
      className="size-full object-cover"
      style={splitStyle ?? undefined}
      draggable={false}
      onError={onError}
    />
  );
}
