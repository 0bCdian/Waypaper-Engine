import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { rendererImage } from "../../types/rendererTypes";

const mockAddImagesToPlaylist = vi.fn();
const mockReadPlaylist = vi.fn().mockReturnValue({
  configuration: { type: "interval" },
  images: [],
});
const mockRemoveImagesFromPlaylist = vi.fn();
const mockAddToSelectedImages = vi.fn();
const mockRemoveFromSelectedImages = vi.fn();
const mockOpenDetail = vi.fn();
const mockOpenContextMenu = vi.fn();
const mockAddToast = vi.fn();
const mockBuildImageMenuItems = vi.fn().mockReturnValue([]);

let mockPlaylistState = {
  addImagesToPlaylist: mockAddImagesToPlaylist,
  readPlaylist: mockReadPlaylist,
  removeImagesFromPlaylist: mockRemoveImagesFromPlaylist,
  isEmpty: true,
  playlistImagesSet: new Set<number>(),
};

let mockImagesState = {
  addToSelectedImages: mockAddToSelectedImages,
  removeFromSelectedImages: mockRemoveFromSelectedImages,
  selectedImages: new Set<number>(),
  renameImage: vi.fn(),
};

let mockMonitorState = {
  monitorSelection: {
    selectedMonitors: ["HDMI-A-1"],
    mode: "individual" as const,
  },
  monitorsList: [],
};

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

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
  useDraggable: () => ({ ref: { current: null }, isDragging: false }),
}));

vi.mock("react-hotkeys-hook", () => ({
  isHotkeyPressed: vi.fn().mockReturnValue(false),
}));

vi.mock("../../stores/monitors", () => ({
  useMonitorStore: (selector: (s: typeof mockMonitorState) => unknown) =>
    selector(mockMonitorState),
}));

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: (selector: (s: typeof mockPlaylistState) => unknown) =>
    selector(mockPlaylistState),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign(
    (selector: (s: typeof mockImagesState) => unknown) => selector(mockImagesState),
    { getState: () => mockImagesState },
  ),
}));

vi.mock("../../stores/designSystemStore", () => ({
  useDesignSystemStore: () => false,
}));

vi.mock("../../stores/imageDetailStore", () => ({
  useImageDetailStore: (selector: (s: { open: typeof mockOpenDetail }) => unknown) =>
    selector({ open: mockOpenDetail }),
}));

vi.mock("../../stores/contextMenuStore", () => ({
  useContextMenuStore: () => mockOpenContextMenu,
}));

vi.mock("../../stores/toastStore", () => ({
  useToastStore: () => mockAddToast,
}));

vi.mock("../../utils/contextMenuItems", () => ({
  buildImageMenuItems: (...args: unknown[]) => mockBuildImageMenuItems(...args),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import ImageCard from "../ImageCard";

function sampleRendererImage(id: number): rendererImage {
  return {
    id,
    name: `image_${id}.jpg`,
    path: `/tmp/images/image_${id}.jpg`,
    media_type: "image",
    duration: 0,
    audio_enabled: false,
    width: 1920,
    height: 1080,
    format: "jpg",
    file_size: 1024000,
    checksum: `sha256:abc${id}`,
    tags: ["nature", "landscape"],
    colors: ["#ff0000", "#00ff00"],
    imported_at: new Date().toISOString(),
    source_path: `/home/user/wallpapers/image_${id}.jpg`,
    is_selected: false,
    thumbnails: {
      default: `/tmp/thumbs/${id}_default.jpg`,
      "720p": `/tmp/thumbs/${id}_720p.jpg`,
      "1080p": `/tmp/thumbs/${id}_1080p.jpg`,
      "1440p": `/tmp/thumbs/${id}_1440p.jpg`,
      "4k": `/tmp/thumbs/${id}_4k.jpg`,
    },
    preview_path: "",
    web_meta: null,
    folder_id: null,
    time: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockPlaylistState = {
    addImagesToPlaylist: mockAddImagesToPlaylist,
    readPlaylist: mockReadPlaylist,
    removeImagesFromPlaylist: mockRemoveImagesFromPlaylist,
    isEmpty: true,
    playlistImagesSet: new Set<number>(),
  };

  mockImagesState = {
    addToSelectedImages: mockAddToSelectedImages,
    removeFromSelectedImages: mockRemoveFromSelectedImages,
    selectedImages: new Set<number>(),
    renameImage: vi.fn(),
  };

  mockMonitorState = {
    monitorSelection: {
      selectedMonitors: ["HDMI-A-1"],
      mode: "individual" as const,
    },
    monitorsList: [],
  };
});

describe("ImageCard", () => {
  it("renders image name and alt text", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    expect(screen.getByText("image_1.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("image_1.jpg")).toBeInTheDocument();
  });

  it("double-click calls goDaemon.setWallpaper with correct args", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const btn = screen.getByRole("button", {
      name: /Set image_1\.jpg as wallpaper/,
    });
    fireEvent.doubleClick(btn);

    expect(window.API_RENDERER.goDaemon.setWallpaper).toHaveBeenCalledWith(
      1,
      "HDMI-A-1",
      "individual",
    );
  });

  it("checking checkbox calls addImagesToPlaylist", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockAddImagesToPlaylist).toHaveBeenCalledWith([1]);
  });

  it("unchecking checkbox calls removeImagesFromPlaylist", () => {
    mockPlaylistState.isEmpty = false;
    mockPlaylistState.playlistImagesSet = new Set([1]);

    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(mockRemoveImagesFromPlaylist).toHaveBeenCalledWith(new Set([1]));
  });

  it("right-click calls context menu open", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const card = screen
      .getByRole("button", {
        name: /Set image_1\.jpg as wallpaper/,
      })
      .closest("[class*='group']")!;
    fireEvent.contextMenu(card);

    expect(mockOpenContextMenu).toHaveBeenCalled();
  });

  it("info button calls imageDetailStore.open", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const infoBtn = screen.getByTitle("Edit details");
    fireEvent.click(infoBtn);

    expect(mockOpenDetail).toHaveBeenCalled();
  });

  it("renders format badge", () => {
    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    expect(screen.getByText("jpg")).toBeInTheDocument();
  });

  it("shows selected overlay when image is in selectedImages", () => {
    mockImagesState.selectedImages = new Set([1]);

    const img = sampleRendererImage(1);
    render(<ImageCard Image={img} />);

    const overlay = screen
      .getByRole("button", {
        name: /Set image_1\.jpg as wallpaper/,
      })
      .querySelector("[data-selected='true']");

    expect(overlay).toBeInTheDocument();
  });

  it("has correct aria-label on the wallpaper button", () => {
    const img = sampleRendererImage(5);
    render(<ImageCard Image={img} />);

    expect(
      screen.getByRole("button", {
        name: "Set image_5.jpg as wallpaper",
      }),
    ).toBeInTheDocument();
  });

  it("uses original gif path as preview source for gif media", () => {
    const img = sampleRendererImage(6);
    img.media_type = "gif";
    img.format = "gif";
    img.path = "/tmp/images/animated_6.gif";
    render(<ImageCard Image={img} />);

    const preview = screen.getByAltText("image_6.jpg") as HTMLImageElement;
    expect(preview.getAttribute("src")).toContain("/tmp/images/animated_6.gif");
  });

  it("renders video element for video media", () => {
    const img = sampleRendererImage(7);
    img.media_type = "video";
    img.format = "mp4";
    img.path = "/tmp/vid.mp4";
    render(<ImageCard Image={img} />);

    const vid = document.querySelector("video");
    expect(vid).toBeTruthy();
    expect(vid?.getAttribute("src")).toContain("/tmp/vid.mp4");
  });

  it("web wallpaper preview uses thumbnail only, not HTML path", () => {
    const img = sampleRendererImage(8);
    img.media_type = "web";
    img.format = "html";
    img.path = "/pkg/index.html";
    img.preview_path = "/pkg/preview.png";
    img.thumbnails = {
      ...img.thumbnails,
      default: "/thumbs/web8.jpg",
    };
    render(<ImageCard Image={img} />);

    const preview = screen.getByAltText("image_8.jpg") as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("/thumbs/web8.jpg");
  });

  it("web wallpaper with gif preview uses preview_path for animated img", () => {
    const img = sampleRendererImage(8);
    img.media_type = "web";
    img.format = "html";
    img.path = "/pkg/index.html";
    img.preview_path = "/pkg/anim.gif";
    img.thumbnails = {
      ...img.thumbnails,
      default: "/thumbs/web8.webp",
    };
    render(<ImageCard Image={img} />);

    const preview = screen.getByAltText("image_8.jpg") as HTMLImageElement;
    expect(preview.getAttribute("src")).toContain("anim.gif");
  });

  it("web wallpaper with mp4 preview uses video element", () => {
    const img = sampleRendererImage(8);
    img.media_type = "web";
    img.format = "html";
    img.path = "/pkg/index.html";
    img.preview_path = "/pkg/clip.mp4";
    img.thumbnails = {
      ...img.thumbnails,
      default: "/thumbs/web8.webp",
    };
    render(<ImageCard Image={img} />);

    const vid = document.querySelector("video");
    expect(vid).toBeTruthy();
    expect(vid?.getAttribute("src")).toContain("clip.mp4");
  });

  it("Edit details opens sidebar for video and raster cards", () => {
    const video = sampleRendererImage(9);
    video.media_type = "video";
    video.format = "mp4";
    video.path = "/tmp/a.mp4";
    const { unmount } = render(<ImageCard Image={video} />);
    fireEvent.click(screen.getByTitle("Edit details"));
    expect(mockOpenDetail).toHaveBeenCalled();
    unmount();
    mockOpenDetail.mockClear();

    const raster = sampleRendererImage(10);
    raster.media_type = "image";
    raster.format = "png";
    render(<ImageCard Image={raster} />);
    fireEvent.click(screen.getByTitle("Edit details"));
    expect(mockOpenDetail).toHaveBeenCalled();
  });
});
