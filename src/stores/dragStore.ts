import { create } from "zustand";

export type DragType = "image" | "folder" | "playlist-item";

export interface DragSourceData {
  type: DragType;
  imageId?: number;
  selectedIds?: number[];
  folderId?: number;
}

export interface DropTargetData {
  type: "folder" | "playlist" | "playlist-item" | "breadcrumb" | "gallery";
  folderId?: number | null;
  imageId?: number;
}

interface DragState {
  isDragging: boolean;
  dragType: DragType | null;
  dragIds: number[];
  overDropTarget: { type: string; id?: number | null } | null;

  setDragStart: (type: DragType, ids: number[]) => void;
  setOverTarget: (target: { type: string; id?: number | null } | null) => void;
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
