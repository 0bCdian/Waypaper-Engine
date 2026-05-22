import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockNavigateToFolder = vi.fn();
const mockFetchPage = vi.fn();

let mockFoldersState = {
  breadcrumbPath: [] as { id: number; name: string }[],
  currentFolderId: null as number | null,
  navigateToFolder: mockNavigateToFolder,
};

vi.mock("../../stores/foldersStore", () => ({
  useFoldersStore: (selector: (s: typeof mockFoldersState) => unknown) =>
    selector(mockFoldersState),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: { getState: () => ({ fetchPage: mockFetchPage }) },
}));

vi.mock("@dnd-kit/react", () => ({
  useDroppable: () => ({ ref: { current: null }, isDropTarget: false }),
}));

import Breadcrumbs from "../Breadcrumbs";

beforeEach(() => {
  vi.clearAllMocks();
  mockFoldersState = {
    breadcrumbPath: [],
    currentFolderId: null,
    navigateToFolder: mockNavigateToFolder,
  };
});

describe("Breadcrumbs", () => {
  it("renders Gallery root when at root", () => {
    render(<Breadcrumbs />);

    expect(screen.getByText("Gallery")).toBeInTheDocument();
    const galleryEl = screen.getByText("Gallery");
    expect(galleryEl.tagName).toBe("SPAN");
  });

  it("renders breadcrumb path with folder names", () => {
    mockFoldersState = {
      ...mockFoldersState,
      currentFolderId: 3,
      breadcrumbPath: [
        { id: 1, name: "Photos" },
        { id: 2, name: "Landscapes" },
        { id: 3, name: "Mountains" },
      ],
    };

    render(<Breadcrumbs />);

    expect(screen.getByText("Gallery")).toBeInTheDocument();
    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(screen.getByText("Landscapes")).toBeInTheDocument();
    expect(screen.getByText("Mountains")).toBeInTheDocument();
  });

  it("clicking a non-last folder calls navigateToFolder", async () => {
    const user = userEvent.setup();

    mockFoldersState = {
      ...mockFoldersState,
      currentFolderId: 2,
      breadcrumbPath: [
        { id: 1, name: "Photos" },
        { id: 2, name: "Landscapes" },
      ],
    };

    render(<Breadcrumbs />);

    await user.click(screen.getByText("Photos"));
    expect(mockNavigateToFolder).toHaveBeenCalledWith(1);
    expect(mockFetchPage).toHaveBeenCalledWith(1, { folder_id: 1 });
  });

  it("last breadcrumb is not clickable (rendered as span)", () => {
    mockFoldersState = {
      ...mockFoldersState,
      currentFolderId: 2,
      breadcrumbPath: [
        { id: 1, name: "Photos" },
        { id: 2, name: "Current" },
      ],
    };

    render(<Breadcrumbs />);

    const lastItem = screen.getByText("Current");
    expect(lastItem.tagName).toBe("SPAN");
  });
});
