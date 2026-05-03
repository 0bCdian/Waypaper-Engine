import type { DragType } from "../stores/dragStore";
import { usePlaylistStore } from "../stores/playlist";

/** True if dragging from gallery could add at least one image not already on the playlist strip. */
export function playlistGalleryDragAddsImages(dragType: DragType | null, dragIds: readonly number[]): boolean {
  if (dragType === "folder") return true;
  if (dragType !== "image") return false;
  if (dragIds.length === 0) return false;
  const inPlaylist = usePlaylistStore.getState().playlistImagesSet;
  return dragIds.some((id) => !inPlaylist.has(id));
}
