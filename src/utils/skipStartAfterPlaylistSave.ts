import type { ActivePlaylistInstance } from "../../electron/daemon-go-types";

function sortedMonitorSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sa = a.toSorted();
  const sb = b.toSorted();
  return a.length === b.length && sa.every((v, i) => v === sb[i]);
}

/** After PATCH, daemon reconcile already refreshed or restarted the run — skip redundant startPlaylist. */
export function shouldSkipPlaylistStartAfterUpdate(opts: {
  savedId: number;
  playlistType: string;
  activePlaylists: ActivePlaylistInstance[];
  selectedMonitors: string[];
  extend: boolean;
}): boolean {
  const active = opts.activePlaylists.find((ap) => ap.playlist_id === opts.savedId);
  if (!active) {
    return false;
  }
  if (active.extend !== opts.extend) {
    return false;
  }
  return sortedMonitorSetsEqual(active.monitors, opts.selectedMonitors);
}
