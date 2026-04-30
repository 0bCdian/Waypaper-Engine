import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

function sortedMonitorSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/** After PATCH, daemon reconcile already refreshed or restarted the run — skip redundant startPlaylist. */
export function shouldSkipPlaylistStartAfterUpdate(opts: {
  savedId: number;
  playlistType: string;
  activePlaylists: ActivePlaylistInstance[];
  selectedMonitors: string[];
  mode: string;
}): boolean {
  const active = opts.activePlaylists.find((ap) => ap.playlist_id === opts.savedId);
  if (!active) {
    return false;
  }
  if (active.mode !== opts.mode) {
    return false;
  }
  return sortedMonitorSetsEqual(active.monitors, opts.selectedMonitors);
}
