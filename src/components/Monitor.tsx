import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import type { monitorSelectType } from "../types/rendererTypes";
import SvgComponent from "./AddImagesIcon";
import { useState, useEffect, useMemo, useRef } from "react";
import { calculateMinResolution, getThumbnailSrc } from "../utils/utilities";
import { logger } from "../utils/logger";
import { resolveWallpaperImageId } from "../utils/resolveWallpaperImageId";
import { daemonClient } from "@/client";

interface props {
  monitor: StoreMonitor;
  scale: number;
  selectType: monitorSelectType;
  monitorsList: StoreMonitor[];
  refreshKey?: number;
}

export function MonitorComponent({ monitor, scale, selectType, monitorsList, refreshKey }: props) {
  const setMonitorsList = useMonitorStore((s) => s.setMonitorsList);
  const [wallpaperSrc, setWallpaperSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchGenerationRef = useRef(0);
  const monitorNameRef = useRef(monitor.name);

  const fetchWallpaperPreview = (onStart: () => void) => {
    const gen = ++fetchGenerationRef.current;
    const monitorName = monitorNameRef.current;
    const endLoadingIfCurrent = () => {
      if (gen === fetchGenerationRef.current) setIsLoading(false);
    };
    onStart();
    void daemonClient
      .getCurrentWallpapers()
      .then((current) => {
        if (gen !== fetchGenerationRef.current) return undefined;
        const imageId = resolveWallpaperImageId(current, monitorName);
        if (imageId == null) {
          setWallpaperSrc(null);
          endLoadingIfCurrent();
          return undefined;
        }
        return daemonClient.getImage(imageId);
      })
      .then((image) => {
        if (gen !== fetchGenerationRef.current) return;
        if (image === undefined) return;
        const src = getThumbnailSrc(image, "1080p");
        setWallpaperSrc(src.trim() !== "" ? src : null);
        endLoadingIfCurrent();
      })
      .catch((err: unknown) => {
        if (gen !== fetchGenerationRef.current) return;
        const msg = String(err instanceof Error ? err.message : err);
        if (msg.includes("not found")) {
          setWallpaperSrc(null);
          endLoadingIfCurrent();
          return;
        }
        logger.warn(`Failed to load wallpaper for ${monitorName}:`, err);
        endLoadingIfCurrent();
      });
  };

  useEffect(() => {
    monitorNameRef.current = monitor.name;
    fetchWallpaperPreview(() => setIsLoading(true));
  }, [refreshKey, monitor.name]);

  // Re-fetch when a wallpaper changes on any monitor
  useEffect(() => {
    const disposeChanged = daemonClient.on("wallpaper_changed", () =>
      fetchWallpaperPreview(() => setIsLoading(true)),
    );
    const disposeReconnected = daemonClient.on("sse_reconnected", () =>
      fetchWallpaperPreview(() => setIsLoading(true)),
    );
    return () => {
      disposeChanged();
      disposeReconnected();
    };
  }, []);

  // For extend mode: compute the image style so each monitor shows its
  // corresponding portion of the wallpaper (like the daemon's image splitter).
  const extendImageStyle = useMemo((): React.CSSProperties | null => {
    if (selectType !== "extend") return null;
    const totalRes = calculateMinResolution(monitorsList);
    if (totalRes.x === 0 || totalRes.y === 0) return null;

    // Scale the full image to cover the entire virtual desktop,
    // then position it so only this monitor's region is visible.
    const scaleX = (totalRes.x / monitor.width) * 100;
    const scaleY = (totalRes.y / monitor.height) * 100;
    const posX = totalRes.x > monitor.width ? (monitor.x / (totalRes.x - monitor.width)) * 100 : 0;
    const posY =
      totalRes.y > monitor.height ? (monitor.y / (totalRes.y - monitor.height)) * 100 : 0;

    return {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: `${posX}% ${posY}%`,
      transform: `scale(${Math.max(scaleX, scaleY) / 100})`,
      transformOrigin: `${posX}% ${posY}%`,
    };
  }, [selectType, monitor, monitorsList]);

  const scaledWidth = monitor.width * scale;
  const scaledHeight = monitor.height * scale;
  const rectangleStyle: React.CSSProperties = {
    width: scaledWidth,
    height: scaledHeight,
    position: "relative",
    overflow: "hidden",
  };
  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <div
      onClick={() => {
        if (monitorsList.length < 1) return;

        const updatedMonitors = monitorsList.map((m) => {
          if (selectType === "individual") {
            return {
              ...m,
              isSelected: !monitor.isSelected
                ? m.name === monitor.name
                : m.name === monitor.name
                  ? false
                  : m.isSelected,
            };
          }
          if (m.name !== monitor.name) return m;
          const currentlySelected = monitorsList.filter((x) => x.isSelected).length;
          if (!monitor.isSelected) {
            return { ...m, isSelected: true };
          }
          if (currentlySelected > 2) {
            return { ...m, isSelected: false };
          }
          return m;
        });
        setMonitorsList(updatedMonitors);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select monitor ${monitor.name}`}
      className="relative select-none rounded-lg"
      draggable={false}
    >
      <div
        draggable={false}
        data-selected={monitor.isSelected}
        style={rectangleStyle}
        className="border-[0.2rem] border-transparent transition-colors duration-200 data-[selected=true]:border-info"
      >
        {isLoading ? (
          <div
            className="flex h-full w-full cursor-pointer items-center justify-center bg-base-200/50"
            style={imageStyle}
          >
            <div className="text-center text-base-content/70">
              <div className="loading loading-spinner loading-md"></div>
              <p className="mt-2 text-sm font-medium">Loading...</p>
            </div>
          </div>
        ) : wallpaperSrc ? (
          <img
            src={wallpaperSrc}
            alt={`Wallpaper on ${monitor.name}`}
            className="h-full w-full cursor-pointer object-cover"
            style={extendImageStyle ?? imageStyle}
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full w-full cursor-pointer items-center justify-center border-2 border-dashed border-base-300 bg-base-200/50"
            style={imageStyle}
          >
            <div className="text-center text-base-content/70">
              <div className="mx-auto mb-2 h-12 w-12 opacity-50">
                <SvgComponent />
              </div>
              <p className="text-sm font-medium">{monitor.name}</p>
              <p className="text-xs opacity-75">
                {monitor.width}x{monitor.height}
              </p>
            </div>
          </div>
        )}
        <div
          draggable={false}
          className="absolute left-0 top-0 bg-base-content/70 px-2 py-1 md:text-lg xl:text-3xl text-base-100"
        >
          {monitor.name}
        </div>
      </div>
    </div>
  );
}
