import { arrayMove } from "@dnd-kit/helpers";
import type { PlaylistImage } from "../../electron/daemon-go-types";

/**
 * Applies a sortable strip move (from initialIndex to index) to playlist rows.
 * Returns null if indices are invalid; callers should no-op the store in that case.
 */
export function reorderPlaylistImagesBySortableMove(
  images: readonly PlaylistImage[],
  from: number,
  to: number,
): PlaylistImage[] | null {
  if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) {
    return null;
  }
  return arrayMove([...images], from, to);
}

/**
 * Chronological order for time_of_day rows. Matches daemon scheduling after buildTimeSlots.
 * Rows with null time sort last (should not happen for persisted time_of_day playlists).
 */
export function sortTimeOfDayPlaylistImages(images: readonly PlaylistImage[]): PlaylistImage[] {
  return [...images].sort((a, b) => {
    if (a.time == null && b.time == null) return 0;
    if (a.time == null) return 1;
    if (b.time == null) return -1;
    return a.time - b.time;
  });
}
