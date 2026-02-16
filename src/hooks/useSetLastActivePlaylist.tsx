import { playlistStore } from "../stores/playlist";
import { useMonitorStore } from "../stores/monitors";
import { type rendererPlaylist } from "../types/rendererTypes";
import { useEffect } from "react";
import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

export function useSetLastActivePlaylist() {
	const { setPlaylist, playlist } = playlistStore();
	const { monitorSelection } = useMonitorStore();

	useEffect(() => {
		if (monitorSelection.selectedMonitors.length === 0) return;

		const monitorName = monitorSelection.selectedMonitors[0];
		if (!monitorName) return;

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/016eda8e-0554-4a39-9dc1-a62053da874d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSetLastActivePlaylist.tsx:effect',message:'effect triggered',data:{monitorName,selectedMonitors:monitorSelection.selectedMonitors},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
		// #endregion

		void goDaemon
			.getActivePlaylistForMonitor(monitorName)
			.then(async (activePlaylist: ActivePlaylistInstance) => {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/016eda8e-0554-4a39-9dc1-a62053da874d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSetLastActivePlaylist.tsx:then',message:'activePlaylist resolved value',data:{activePlaylist,type:typeof activePlaylist,keys:activePlaylist?Object.keys(activePlaylist):null,playlist_id:activePlaylist?.playlist_id},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
				// #endregion

				if (!activePlaylist) return;

				// Fetch the full playlist to get image list
				const fullPlaylist = await goDaemon.getPlaylist(
					activePlaylist.playlist_id,
				);
				if (!fullPlaylist || !fullPlaylist.images || fullPlaylist.images.length < 1) {
					return;
				}

				if (playlist.name === fullPlaylist.name) return;

				const currentPlaylist: rendererPlaylist = {
					id: fullPlaylist.id,
					name: fullPlaylist.name,
					configuration: fullPlaylist.configuration,
					images: fullPlaylist.images,
				};
				setPlaylist(currentPlaylist);
			})
			.catch((err) => {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/016eda8e-0554-4a39-9dc1-a62053da874d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSetLastActivePlaylist.tsx:catch',message:'promise rejected (expected for no active playlist)',data:{error:String(err)},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
				// #endregion
				// No active playlist for this monitor
			});
	}, [monitorSelection]);
}
