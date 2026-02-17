import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import type {
	WallpaperChangedPayload,
	ProcessingCompletePayload,
	PlaylistEventPayload,
} from "../../electron/daemon-go-types";

const goDaemon = window.API_RENDERER.goDaemon;

export default function useNotifications(): void {
	const config = useSettingsStore((s) => s.config);
	const addToast = useToastStore((s) => s.addToast);

	useEffect(() => {
		if (!config?.app?.notifications) return;
		if (!goDaemon?.on) return;

		const onWallpaperChanged = (data: unknown) => {
			const payload = data as WallpaperChangedPayload;
			const monitors = payload?.monitors?.join(", ") ?? "unknown";
			addToast(`Wallpaper set on ${monitors}`, "success");
		};

		const onProcessingComplete = (data: unknown) => {
			const payload = data as ProcessingCompletePayload;
			const msg =
				payload?.failed > 0
					? `Processing complete: ${payload.succeeded} images (${payload.failed} errors)`
					: `Processing complete: ${payload.succeeded} images`;
			addToast(msg, payload?.failed > 0 ? "warning" : "success");
		};

		const onPlaylistStarted = (data: unknown) => {
			const payload = data as PlaylistEventPayload;
			const name = payload?.monitor ?? "";
			addToast(`Playlist started${name ? ` on ${name}` : ""}`, "info");
		};

		const onPlaylistStopped = (data: unknown) => {
			const payload = data as PlaylistEventPayload;
			const name = payload?.monitor ?? "";
			addToast(`Playlist stopped${name ? ` on ${name}` : ""}`, "info");
		};

		const disposeWallpaper = goDaemon.on("wallpaper_changed", onWallpaperChanged);
		const disposeProcessing = goDaemon.on("processing_complete", onProcessingComplete);
		const disposePlaylistStart = goDaemon.on("playlist_started", onPlaylistStarted);
		const disposePlaylistStop = goDaemon.on("playlist_stopped", onPlaylistStopped);

		return () => {
			disposeWallpaper();
			disposeProcessing();
			disposePlaylistStart();
			disposePlaylistStop();
		};
	}, [config, addToast]);
}
