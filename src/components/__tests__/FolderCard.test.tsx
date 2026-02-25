import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Folder } from "../../../electron/daemon-go-types";

const mockNavigateToFolder = vi.fn();
const mockFetchPage = vi.fn();
const mockOpenContextMenu = vi.fn();
const mockAddToast = vi.fn();

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

vi.mock("../../hooks/useIsNeo", () => ({ useIsNeo: () => false }));

vi.mock("../../hooks/useInlineRename", () => ({
  useInlineRename: () => ({
    isRenaming: false,
    renameName: "",
    setRenameName: vi.fn(),
    renameInputRef: { current: null },
    startRename: vi.fn(),
    submitRename: vi.fn(),
    cancelRename: vi.fn(),
  }),
}));

vi.mock("@dnd-kit/react", () => ({
  useDraggable: () => ({ ref: vi.fn(), isDragging: false }),
  useDroppable: () => ({ ref: vi.fn(), isDropTarget: false }),
}));

vi.mock("../../utils/contextMenuItems", () => ({
  buildFolderMenuItems: vi.fn().mockReturnValue([]),
}));

vi.mock("../../stores/foldersStore", () => ({
  useFoldersStore: Object.assign(
    (selector: Function) =>
      selector({
        navigateToFolder: mockNavigateToFolder,
        folderPreviews: new Map(),
        renameFolder: vi.fn(),
      }),
    {
      getState: () => ({
        renameFolder: vi.fn(),
      }),
    },
  ),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: { getState: () => ({ fetchPage: mockFetchPage }) },
}));

vi.mock("../../stores/contextMenuStore", () => ({
  useContextMenuStore: (selector: Function) => selector({ open: mockOpenContextMenu }),
}));

vi.mock("../../stores/toastStore", () => ({
  useToastStore: (selector: Function) => selector({ addToast: mockAddToast }),
}));

import FolderCard from "../FolderCard";

function sampleFolder(): Folder {
  return {
    id: 1,
    name: "My Folder",
    parent_id: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FolderCard", () => {
  it("renders folder name", () => {
    render(<FolderCard folder={sampleFolder()} />);

    expect(screen.getByText("My Folder")).toBeInTheDocument();
  });

  it("click navigates to folder and fetches first page", () => {
    render(<FolderCard folder={sampleFolder()} />);

    fireEvent.click(screen.getByRole("button"));

    expect(mockNavigateToFolder).toHaveBeenCalledWith(1);
    expect(mockFetchPage).toHaveBeenCalledWith(1, { folder_id: 1 });
  });

  it("right-click opens context menu", () => {
    render(<FolderCard folder={sampleFolder()} />);

    fireEvent.contextMenu(screen.getByRole("button"));

    expect(mockOpenContextMenu).toHaveBeenCalled();
  });
});
