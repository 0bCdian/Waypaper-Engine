import { useEffect, useRef, useState } from "react";
import type { Image, MonitorMode } from "../../electron/daemon-go-types";
import type { StoreMonitor } from "../stores/monitors";
import { daemonClient } from "@/client";
import { resolveWallpaperImageId } from "../utils/resolveWallpaperImageId";
import { logger } from "../utils/logger";

/**
 * The wallpaper actually displayed on each monitor right now, as reported by
 * the daemon (`GET /wallpaper/current`). This is a *mirror* of live state — it
 * never reflects unsaved editor choices in the monitor modal.
 */
export interface LiveWallpapers {
  /** The mode the live wallpaper was applied in, not any editor selection. */
  mode: MonitorMode;
  /** Monitor name → its current image, or `null` when none / image deleted. */
  byMonitor: Map<string, Image | null>;
  loading: boolean;
}

function normalizeMode(mode: string): MonitorMode {
  return mode === "clone" || mode === "extend" ? mode : "individual";
}

/**
 * Fetches the live per-monitor wallpaper state once, deduping image lookups,
 * and re-fetches on `wallpaper_changed` / `sse_reconnected` events and whenever
 * `refreshKey` changes (`0` means the modal was never opened, so nothing is fetched). Replaces the per-`MonitorComponent` fetching so the
 * modal makes one `getCurrentWallpapers` call regardless of monitor count.
 */
export function useLiveWallpapers(monitors: StoreMonitor[], refreshKey: number): LiveWallpapers {
  const [state, setState] = useState<LiveWallpapers>({
    mode: "individual",
    byMonitor: new Map(),
    loading: true,
  });
  const generationRef = useRef(0);
  // Derive a stable string key so the effect re-runs only when the actual set
  // of monitor names changes, not on every new array identity from the store.
  // Compositor output names (DP-1, HDMI-A-1, …) never contain spaces.
  const monitorNames = monitors.map((m) => m.name).join("\0");

  useEffect(() => {
    // The modal stays mounted while closed; fetch nothing until it has been opened (refreshKey > 0).
    if (refreshKey === 0) return;
    let cancelled = false;

    const load = () => {
      const gen = ++generationRef.current;
      setState((prev) => ({ ...prev, loading: true }));
      void daemonClient
        .getCurrentWallpapers()
        .then(async (current) => {
          const mode = normalizeMode(current.mode);
          const names = monitorNames.length > 0 ? monitorNames.split("\0") : [];

          const idByMonitor = new Map<string, number | null>();
          const uniqueIds = new Set<number>();
          for (const name of names) {
            const id = resolveWallpaperImageId(current, name);
            idByMonitor.set(name, id);
            if (id != null) uniqueIds.add(id);
          }

          const imageById = new Map<number, Image | null>();
          await Promise.all(
            [...uniqueIds].map(async (id) => {
              try {
                imageById.set(id, await daemonClient.getImage(id));
              } catch (err) {
                const msg = String(err instanceof Error ? err.message : err);
                if (!msg.includes("not found")) {
                  logger.warn(`useLiveWallpapers: failed to load image ${id}:`, err);
                }
                imageById.set(id, null);
              }
            }),
          );

          if (cancelled || gen !== generationRef.current) return;
          const byMonitor = new Map<string, Image | null>();
          for (const [name, id] of idByMonitor) {
            byMonitor.set(name, id == null ? null : (imageById.get(id) ?? null));
          }
          setState({ mode, byMonitor, loading: false });
        })
        .catch((err: unknown) => {
          if (cancelled || gen !== generationRef.current) return;
          logger.warn("useLiveWallpapers: failed to load current wallpapers:", err);
          setState((prev) => ({ ...prev, loading: false }));
        });
    };

    load();

    const disposeChanged = daemonClient.on("wallpaper_changed", load);
    const disposeReconnected = daemonClient.on("sse_reconnected", load);
    return () => {
      cancelled = true;
      disposeChanged();
      disposeReconnected();
    };
  }, [monitorNames, refreshKey]);

  return state;
}
