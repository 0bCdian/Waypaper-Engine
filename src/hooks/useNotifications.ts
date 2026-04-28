import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import type {
  WallpaperChangedPayload,
  ProcessingCompletePayload,
  ProcessingStartedPayload,
  PlaylistEventPayload,
  PlaylistImageChangedPayload,
  MonitorEventPayload,
} from "../../electron/daemon-go-types";

const goDaemon = window.API_RENDERER.goDaemon;

export default function useNotifications(): void {
  const notificationsEnabled = useSettingsStore((s) => s.config?.app?.notifications);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (!goDaemon?.on) return;

    const disposers: (() => void)[] = [];

    disposers.push(
      goDaemon.on("wallpaper_changed", (data: unknown) => {
        const payload = data as WallpaperChangedPayload;
        const monitors = payload?.monitors?.join(", ") ?? "unknown";
        addToast(`Wallpaper set on ${monitors}`, "success");
      }),
    );

    disposers.push(
      goDaemon.on("processing_started", (data: unknown) => {
        const payload = data as ProcessingStartedPayload;
        addToast(`Importing ${payload?.total ?? 0} images...`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("processing_complete", (data: unknown) => {
        const payload = data as ProcessingCompletePayload;
        const msg =
          payload?.failed > 0
            ? `Processing complete: ${payload.succeeded} images (${payload.failed} errors)`
            : `Processing complete: ${payload.succeeded} images`;
        addToast(msg, payload?.failed > 0 ? "warning" : "success");
      }),
    );

    disposers.push(
      goDaemon.on("playlist_started", (data: unknown) => {
        const payload = data as PlaylistEventPayload;
        const name = payload?.monitor ?? "";
        addToast(`Playlist started${name ? ` on ${name}` : ""}`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("playlist_stopped", (data: unknown) => {
        const payload = data as PlaylistEventPayload;
        const name = payload?.monitor ?? "";
        addToast(`Playlist stopped${name ? ` on ${name}` : ""}`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("playlist_paused", (data: unknown) => {
        const payload = data as PlaylistEventPayload;
        const name = payload?.monitor ?? "";
        addToast(`Playlist paused${name ? ` on ${name}` : ""}`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("playlist_resumed", (data: unknown) => {
        const payload = data as PlaylistEventPayload;
        const name = payload?.monitor ?? "";
        addToast(`Playlist resumed${name ? ` on ${name}` : ""}`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("playlist_image_changed", (data: unknown) => {
        const payload = data as PlaylistImageChangedPayload;
        const monitor = payload?.monitor ?? "";
        addToast(`Playlist advanced${monitor ? ` on ${monitor}` : ""}`, "info", 3000);
      }),
    );

    disposers.push(
      goDaemon.on("monitor_connected", (data: unknown) => {
        const payload = data as MonitorEventPayload;
        addToast(`Monitor connected: ${payload?.name ?? "unknown"}`, "info");
      }),
    );

    disposers.push(
      goDaemon.on("monitor_disconnected", (data: unknown) => {
        const payload = data as MonitorEventPayload;
        addToast(`Monitor disconnected: ${payload?.name ?? "unknown"}`, "warning");
      }),
    );

    disposers.push(
      goDaemon.on("backend_unavailable", (data: unknown) => {
        const payload = data as { message?: string; backend?: string };
        const msg =
          payload?.message ??
          `Wallpaper backend (${payload?.backend ?? "unknown"}) is not available.`;
        addToast(msg, "error", 12_000);
      }),
    );

    disposers.push(
      goDaemon.on("wallpaper_restore_failed", (data: unknown) => {
        const payload = data as {
          backend?: string;
          failures?: Array<{ monitor?: string; reason?: string }>;
        };
        const failures = payload?.failures ?? [];
        const monitors = failures.map((f) => f.monitor ?? "unknown");
        const unique = [...new Set(monitors)];
        const reasons = [...new Set(failures.map((f) => f.reason ?? "unknown error"))];
        addToast(
          `Could not restore wallpaper on ${unique.join(", ")}: ${reasons.join("; ")} (backend: ${payload?.backend ?? "unknown"})`,
          "error",
          12_000,
        );
      }),
    );

    disposers.push(
      goDaemon.on("playlist_skipped_incompatible", (data: unknown) => {
        const payload = data as {
          playlist_name?: string;
          backend?: string;
          skipped?: number;
          skipped_items?: Array<{
            image_id?: number;
            media_type?: string;
            slot_index?: number;
          }>;
        };
        const backend = payload?.backend ?? "current backend";
        const first = payload?.skipped_items?.[0];
        const rest = (payload?.skipped ?? 0) - 1;
        const more = rest > 0 ? ` (${rest} more skipped)` : "";
        const msg =
          first != null
            ? `Backend ${String(backend)} does not support image ${String(first.image_id ?? "?")} (type ${String(first.media_type || "unknown")}) — skipping${more}`
            : `Skipped ${String(payload?.skipped ?? "some")} playlist items: ${String(backend)} does not support their media type`;
        addToast(msg, "warning", 8_000);
      }),
    );

    disposers.push(
      goDaemon.on("playlist_no_compatible_item", (data: unknown) => {
        const payload = data as {
          playlist_name?: string;
          backend?: string;
        };
        addToast(
          `No items in "${payload?.playlist_name ?? "playlist"}" are compatible with ${payload?.backend ?? "current backend"}`,
          "error",
          10_000,
        );
      }),
    );

    disposers.push(
      goDaemon.on("sse_disconnected", () => {
        addToast("Lost connection to daemon — reconnecting...", "warning", 0);
      }),
    );

    disposers.push(
      goDaemon.on("sse_reconnected", () => {
        addToast("Reconnected to daemon", "success");
      }),
    );

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [notificationsEnabled, addToast]);
}
