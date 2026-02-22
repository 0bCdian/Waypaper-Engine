import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { useShallow } from "zustand/react/shallow";
import type { rendererPlaylist } from "../types/rendererTypes";
import { useEffect, useRef } from "react";
import type { ActivePlaylistResponse } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

function monitorSetsMatch(
	selected: string[],
	playlistMonitors: { name: string }[],
): boolean {
	if (selected.length !== playlistMonitors.length) return false;
	const a = new Set(selected);
	return playlistMonitors.every((m) => a.has(m.name));
}

export function useSetLastActivePlaylist() {
	const { setPlaylist, clearPlaylist } = usePlaylistStore(
		useShallow((s) => ({
			setPlaylist: s.setPlaylist,
			clearPlaylist: s.clearPlaylist,
		})),
	);
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const setActivePlaylist = useActivePlaylistStore(
		(s) => s.setActivePlaylist,
	);
	const clearActive = useActivePlaylistStore((s) => s.clear);
	const lastSyncedIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (monitorSelection.selectedMonitors.length === 0) {
			clearActive();
			return;
		}

		let cancelled = false;

		void goDaemon
			.getActivePlaylists()
			.then(async (activePlaylists: ActivePlaylistResponse[]) => {
				if (cancelled) return;

				if (!activePlaylists || activePlaylists.length === 0) {
					clearActive();
					clearPlaylist();
					lastSyncedIdRef.current = null;
					return;
				}

				const match = activePlaylists.find((ap) =>
					monitorSetsMatch(
						monitorSelection.selectedMonitors,
						ap.monitors,
					),
				);

				if (!match) {
					clearActive();
					clearPlaylist();
					lastSyncedIdRef.current = null;
					return;
				}

				setActivePlaylist(match);

				if (lastSyncedIdRef.current === match.playlist_id) {
					return;
				}

				const fullPlaylist = await goDaemon.getPlaylist(
					match.playlist_id,
				);
				if (cancelled) return;

				if (
					!fullPlaylist ||
					!fullPlaylist.images ||
					fullPlaylist.images.length < 1
				) {
					return;
				}

				lastSyncedIdRef.current = match.playlist_id;
				const currentPlaylist: rendererPlaylist = {
					id: fullPlaylist.id,
					name: fullPlaylist.name,
					configuration: fullPlaylist.configuration,
					images: fullPlaylist.images,
				};
				setPlaylist(currentPlaylist);
				await useImagesStore
					.getState()
					.fetchMissingImages(
						fullPlaylist.images.map((img) => img.image_id),
					);
			})
			.catch(() => {
				clearActive();
			});

		return () => {
			cancelled = true;
		};
	}, [
		monitorSelection,
		setPlaylist,
		clearPlaylist,
		setActivePlaylist,
		clearActive,
	]);

	useEffect(() => {
		const disposers = [
			goDaemon.on("playlist_started", () => {
				void refreshActivePlaylist();
			}),
			goDaemon.on("playlist_stopped", () => {
				void refreshActivePlaylist();
			}),
			goDaemon.on("playlist_paused", () => {
				void refreshActivePlaylist();
			}),
			goDaemon.on("playlist_resumed", () => {
				void refreshActivePlaylist();
			}),
			goDaemon.on("playlist_image_changed", () => {
				void refreshActivePlaylist();
			}),
		];

		return () => {
			for (const d of disposers) d();
		};

	async function refreshActivePlaylist() {
		const selected =
			useMonitorStore.getState().monitorSelection.selectedMonitors;
		if (selected.length === 0) return;

		let activePlaylists: ActivePlaylistResponse[] | undefined;
		try {
			activePlaylists = await goDaemon.getActivePlaylists();
		} catch {
			return;
		}

		if (!activePlaylists || activePlaylists.length === 0) {
			useActivePlaylistStore.getState().clear();
			return;
		}
		const match = activePlaylists.find((ap) =>
			monitorSetsMatch(selected, ap.monitors),
		);
		useActivePlaylistStore
			.getState()
			.setActivePlaylist(match ?? null);
	}
	}, []);
}
