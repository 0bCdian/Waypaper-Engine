import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockActivePlaylist: {
  playlist_id: number;
  playlist_name: string;
  monitors: string[];
  current_image_id: number;
  current_index: number;
  total_images: number;
  paused: boolean;
  next_change_at?: string;
} | null = null;

const mockImagesMap = new Map<
  number,
  { id: number; name: string; thumbnails: Record<string, string>; path: string }
>();

vi.mock("../../stores/activePlaylistStore", () => ({
  useActivePlaylistStore: (
    selector: (s: { activePlaylist: typeof mockActivePlaylist }) => unknown,
  ) => selector({ activePlaylist: mockActivePlaylist }),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: (selector: (s: { imagesMap: typeof mockImagesMap }) => unknown) =>
    selector({ imagesMap: mockImagesMap }),
}));

vi.mock("../../hooks/useIsNeo", () => ({
  useIsNeo: () => false,
}));

vi.mock("../../utils/utilities", () => ({
  getThumbnailSrc: (image: { name: string }) => `/thumbs/${image.name}`,
}));

import PlaylistController from "../PlaylistController";

beforeEach(() => {
  vi.clearAllMocks();
  mockActivePlaylist = null;
  mockImagesMap.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlaylistController", () => {
  it("renders nothing when no active playlist", () => {
    const { container } = render(<PlaylistController />);

    expect(container.firstChild).toBeNull();
  });

  it("shows progress bar and elapsed time when next_change_at is set", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T14:00:00.000Z"));

    mockActivePlaylist = {
      playlist_id: 1,
      playlist_name: "Timed",
      monitors: ["HDMI-1"],
      current_image_id: 99,
      current_index: 0,
      total_images: 3,
      paused: false,
      next_change_at: "2026-06-15T14:01:00.000Z",
    };
    mockImagesMap.set(99, {
      id: 99,
      name: "wall.jpg",
      thumbnails: { small: "/thumbs/wall_sm.jpg" },
      path: "/images/wall.jpg",
    });

    render(<PlaylistController />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("-1:00")).toBeInTheDocument();
  });

  it("shows clocks when paused and next_change_at is set (no timer tick)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T14:00:00.000Z"));

    mockActivePlaylist = {
      playlist_id: 2,
      playlist_name: "Paused",
      monitors: ["HDMI-1"],
      current_image_id: 100,
      current_index: 1,
      total_images: 5,
      paused: true,
      next_change_at: "2026-06-15T14:02:00.000Z",
    };
    mockImagesMap.set(100, {
      id: 100,
      name: "x.png",
      thumbnails: { small: "/thumbs/x_sm.jpg" },
      path: "/images/x.png",
    });

    render(<PlaylistController />);

    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("-2:00")).toBeInTheDocument();
  });

  it("renders playlist name, image name, and monitor badges", () => {
    mockActivePlaylist = {
      playlist_id: 1,
      playlist_name: "My Playlist",
      monitors: ["HDMI-1", "DP-2"],
      current_image_id: 42,
      current_index: 2,
      total_images: 10,
      paused: false,
    };
    mockImagesMap.set(42, {
      id: 42,
      name: "sunset.jpg",
      thumbnails: { small: "/thumbs/sunset_sm.jpg" },
      path: "/images/sunset.jpg",
    });

    render(<PlaylistController />);

    expect(screen.getByText("My Playlist")).toBeInTheDocument();
    expect(screen.getByAltText("sunset.jpg")).toBeInTheDocument();
  });

  it("Previous button calls goDaemon.previousPlaylistImage", async () => {
    const user = userEvent.setup();
    mockActivePlaylist = {
      playlist_id: 5,
      playlist_name: "Test",
      monitors: ["HDMI-1"],
      current_image_id: 1,
      current_index: 0,
      total_images: 3,
      paused: false,
    };

    render(<PlaylistController />);

    await user.click(screen.getByTitle("Previous"));
    expect(window.API_RENDERER.goDaemon.previousPlaylistImage).toHaveBeenCalledWith(5);
  });

  it("Next button calls goDaemon.nextPlaylistImage", async () => {
    const user = userEvent.setup();
    mockActivePlaylist = {
      playlist_id: 5,
      playlist_name: "Test",
      monitors: ["HDMI-1"],
      current_image_id: 1,
      current_index: 0,
      total_images: 3,
      paused: false,
    };

    render(<PlaylistController />);

    await user.click(screen.getByTitle("Next"));
    expect(window.API_RENDERER.goDaemon.nextPlaylistImage).toHaveBeenCalledWith(5);
  });

  it("Pause button calls goDaemon.pausePlaylist when playing", async () => {
    const user = userEvent.setup();
    mockActivePlaylist = {
      playlist_id: 7,
      playlist_name: "Active",
      monitors: ["HDMI-1"],
      current_image_id: 1,
      current_index: 0,
      total_images: 5,
      paused: false,
    };

    render(<PlaylistController />);

    await user.click(screen.getByTitle("Pause"));
    expect(window.API_RENDERER.goDaemon.pausePlaylist).toHaveBeenCalledWith(7);
  });

  it("Resume button calls goDaemon.resumePlaylist when paused", async () => {
    const user = userEvent.setup();
    mockActivePlaylist = {
      playlist_id: 7,
      playlist_name: "Paused",
      monitors: ["HDMI-1"],
      current_image_id: 1,
      current_index: 0,
      total_images: 5,
      paused: true,
    };

    render(<PlaylistController />);

    await user.click(screen.getByTitle("Resume"));
    expect(window.API_RENDERER.goDaemon.resumePlaylist).toHaveBeenCalledWith(7);
  });

  it("Stop button calls goDaemon.stopPlaylist", async () => {
    const user = userEvent.setup();
    mockActivePlaylist = {
      playlist_id: 9,
      playlist_name: "Running",
      monitors: ["HDMI-1"],
      current_image_id: 1,
      current_index: 0,
      total_images: 2,
      paused: false,
    };

    render(<PlaylistController />);

    await user.click(screen.getByTitle("Stop"));
    expect(window.API_RENDERER.goDaemon.stopPlaylist).toHaveBeenCalledWith(9);
  });
});
