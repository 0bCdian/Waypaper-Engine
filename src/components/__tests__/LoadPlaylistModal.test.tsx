import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Playlist } from "../../../electron/daemon-go-types";

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockClearPlaylist = vi.fn();
const mockSetPlaylist = vi.fn();

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      clearPlaylist: mockClearPlaylist,
      setPlaylist: mockSetPlaylist,
    }),
}));

vi.mock("../../stores/monitors", () => ({
  useMonitorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      monitorSelection: {
        selectedMonitors: ["HDMI-A-1"],
        mode: "individual" as const,
      },
    }),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: {
    getState: () => ({ fetchMissingImages: vi.fn() }),
  },
}));

vi.mock("../../stores/modalStore", () => ({
  useModalStore: {
    getState: () => ({
      register: vi.fn(),
      unregister: vi.fn(),
    }),
  },
}));

vi.mock("../Modal", () => ({
  default: React.forwardRef(
    (
      {
        children,
        stripedHeader,
      }: React.PropsWithChildren<{ stripedHeader?: { title?: React.ReactNode } }>,
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        showModal: vi.fn(),
        close: vi.fn(),
      }));
      return (
        <div>
          {stripedHeader?.title != null ? (
            // Title can be ReactNode in other modals; coerced for tests that assert text content
            <h2>{stripedHeader.title}</h2>
          ) : null}
          {children}
        </div>
      );
    },
  ),
}));

vi.mock("../ConfirmDialog", () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import LoadPlaylistModal from "../LoadPlaylistModal";

function makePlaylist(id: number, name: string): Playlist {
  return {
    id,
    name,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    configuration: {
      type: "timer",
      interval: 300,
      order: "ordered",
      always_start_on_first_image: false,
    },
    images: [],
  };
}

const defaultProps = {
  playlistsInDB: [] as Playlist[],
  currentPlaylistName: "",
  onPlaylistChanged: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoadPlaylistModal", () => {
  it("renders title 'Load Playlist'", () => {
    render(<LoadPlaylistModal {...defaultProps} />);

    expect(screen.getByText("Load Playlist")).toBeInTheDocument();
  });

  it("shows empty-library copy when no playlists passed", () => {
    render(<LoadPlaylistModal {...defaultProps} />);

    expect(screen.getByText(/No playlists in the library/)).toBeInTheDocument();
  });

  it("shows 'Refresh playlists' button that calls onPlaylistChanged", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();

    render(<LoadPlaylistModal {...defaultProps} onPlaylistChanged={onChanged} />);

    const refreshBtn = screen.getByRole("button", {
      name: /Refresh playlists/i,
    });
    expect(refreshBtn).toBeInTheDocument();

    await user.click(refreshBtn);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("renders playlist dropdown when playlists provided", () => {
    const playlists = [makePlaylist(1, "Morning Vibes"), makePlaylist(2, "Night Cycle")];

    render(<LoadPlaylistModal {...defaultProps} playlistsInDB={playlists} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Morning Vibes")).toBeInTheDocument();
    expect(screen.getByText("Night Cycle")).toBeInTheDocument();
  });

  it("shows Delete button when playlists are present", () => {
    const playlists = [makePlaylist(1, "Test Playlist")];

    render(<LoadPlaylistModal {...defaultProps} playlistsInDB={playlists} />);

    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
  });
});
