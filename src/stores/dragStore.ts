import { create } from "zustand";

export type DragType = "image" | "folder" | "playlist-item";

export interface DragSourceData {
  type: DragType;
  imageId?: number;
  selectedIds?: number[];
  folderId?: number;
  /** Playlist strip card index: gallery drops insert before this slot */
  insertIndex?: number;
}

export interface DropTargetData {
  type: "folder" | "playlist" | "playlist-item" | "breadcrumb" | "gallery";
  folderId?: number | null;
  imageId?: number;
  /** When dropping onto a strip card, insert new images before this index */
  insertIndex?: number;
}

interface DragOverTargetSnapshot {
  type: string;
  id?: number | null;
  /** Insert-before index while dragging gallery/folder over the playlist strip (append-at-end = playlist length). */
  playlistInsertPreviewAt?: number | null;
}

interface DragState {
  isDragging: boolean;
  dragType: DragType | null;
  dragIds: number[];
  overDropTarget: DragOverTargetSnapshot | null;

  setDragStart: (type: DragType, ids: number[]) => void;
  setOverTarget: (target: DragOverTargetSnapshot | null) => void;
  reset: () => void;
}

export const useDragStore = create<DragState>()((set) => ({
  isDragging: false,
  dragType: null,
  dragIds: [],
  overDropTarget: null,

  setDragStart: (type, ids) => set({ isDragging: true, dragType: type, dragIds: ids }),

  setOverTarget: (target) => set({ overDropTarget: target }),

  reset: () =>
    set({
      isDragging: false,
      dragType: null,
      dragIds: [],
      overDropTarget: null,
    }),
}));
