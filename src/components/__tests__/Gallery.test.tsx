import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockFetchFolders = vi.fn();

let mockImagesState = {
  isEmpty: false,
  isQueried: true,
  filters: {
    order: "desc",
    type: "id",
    searchString: "",
    tags: [],
    advancedFilters: {
      formats: ["jpeg", "jpg", "webp", "gif", "png", "bmp", "tiff", "tga", "pnm", "farbfeld"],
      resolution: { constraint: "all", width: 0, height: 0 },
      colors: [] as string[],
    },
  },
};

let mockFoldersState = {
  currentFolderId: null as number | null,
  folders: [] as { id: number; name: string }[],
  fetchFolders: mockFetchFolders,
};

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign(
    (selector: (s: typeof mockImagesState) => unknown) => selector(mockImagesState),
    { getState: () => mockImagesState },
  ),
}));

vi.mock("../../stores/foldersStore", () => ({
  useFoldersStore: Object.assign(
    (selector: (s: typeof mockFoldersState) => unknown) => selector(mockFoldersState),
    { getState: () => mockFoldersState },
  ),
}));

vi.mock("../../hooks/useLoadImages", () => ({
  useLoadImages: () => {},
}));

vi.mock("../AddImagesCard", () => ({
  default: () => <div data-testid="add-images-card">AddImagesCard</div>,
}));

vi.mock("../PaginatedGallery", () => ({
  default: () => <div data-testid="paginated-gallery">PaginatedGallery</div>,
}));

vi.mock("../Filters", () => ({
  default: () => <div data-testid="filters">Filters</div>,
}));

vi.mock("../Breadcrumbs", () => ({
  default: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

import Gallery from "../Gallery";

beforeEach(() => {
  vi.clearAllMocks();
  mockImagesState = {
    isEmpty: false,
    isQueried: true,
    filters: {
      order: "desc",
      type: "id",
      searchString: "",
      tags: [],
      advancedFilters: {
        formats: ["jpeg", "jpg", "webp", "gif", "png", "bmp", "tiff", "tga", "pnm", "farbfeld"],
        resolution: { constraint: "all", width: 0, height: 0 },
        colors: [],
      },
    },
  };
  mockFoldersState = {
    currentFolderId: null,
    folders: [],
    fetchFolders: mockFetchFolders,
  };
});

describe("Gallery", () => {
  it("renders empty state when isEmpty, isQueried, and no folders", () => {
    mockImagesState = { ...mockImagesState, isEmpty: true, isQueried: true };

    render(<Gallery />);

    expect(screen.getByTestId("add-images-card")).toBeInTheDocument();
    expect(screen.queryByTestId("paginated-gallery")).not.toBeInTheDocument();
  });

  it("renders Breadcrumbs, Filters, and PaginatedGallery when images exist", () => {
    mockImagesState = { ...mockImagesState, isEmpty: false, isQueried: true };

    render(<Gallery />);

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    expect(screen.getByTestId("filters")).toBeInTheDocument();
    expect(screen.getByTestId("paginated-gallery")).toBeInTheDocument();
    expect(screen.queryByTestId("add-images-card")).not.toBeInTheDocument();
  });

  it("renders gallery when filters are active even if no images", () => {
    mockImagesState = {
      ...mockImagesState,
      isEmpty: true,
      isQueried: true,
      filters: {
        ...mockImagesState.filters,
        searchString: "landscape",
      },
    };

    render(<Gallery />);

    expect(screen.getByTestId("paginated-gallery")).toBeInTheDocument();
    expect(screen.queryByTestId("add-images-card")).not.toBeInTheDocument();
  });

  it("calls fetchFolders on mount", () => {
    render(<Gallery />);

    expect(mockFetchFolders).toHaveBeenCalledWith(null);
  });

  it("subscribes to folders_updated daemon event", () => {
    const { goDaemon } = window.API_RENDERER;

    render(<Gallery />);

    expect(goDaemon.on).toHaveBeenCalledWith("folders_updated", expect.any(Function));
  });
});
