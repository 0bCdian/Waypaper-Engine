import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

vi.mock("../../hooks/useIsNeo", () => ({ useIsNeo: () => false }));

vi.mock("../../hooks/useSetLastActivePlaylist", () => ({
  useSetLastActivePlaylist: vi.fn(),
}));

vi.mock("@dnd-kit/react", () => ({
  useDroppable: () => ({ ref: vi.fn(), isDropTarget: false }),
}));

const mockClearPlaylist = vi.fn();
const mockSetPlaylist = vi.fn();
const mockMovePlaylistArrayOrder = vi.fn();

let mockPlaylist = {
  id: null as number | null,
  name: "",
  configuration: {
    type: "timer",
    interval: 300,
    order: "ordered",
    always_start_on_first_image: false,
  },
  images: [] as Array<{ image_id: number; time?: number | null }>,
};
let mockIsDirty = false;

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: Object.assign(
    (selector: Function) =>
      selector({
        playlist: mockPlaylist,
        lastAddedImageID: null,
        isDirty: mockIsDirty,
        stripScrollToImageIdOnce: null,
        clearStripScrollIntent: vi.fn(),
        movePlaylistArrayOrder: mockMovePlaylistArrayOrder,
        clearPlaylist: mockClearPlaylist,
        setPlaylist: mockSetPlaylist,
      }),
    { getState: () => ({ playlist: mockPlaylist, stripScrollToImageIdOnce: null }) },
  ),
}));

vi.mock("../../stores/monitors", () => ({
  useMonitorStore: (selector: Function) =>
    selector({
      monitorSelection: { selectedMonitors: ["HDMI-A-1"], mode: "individual" },
    }),
}));

vi.mock("../../hooks/useOpenImages", () => ({
  default: (selector: Function) => selector({ openImages: vi.fn(), isActive: false }),
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign((selector: Function) => selector({ imagesMap: new Map() }), {
    getState: () => ({ fetchMissingImages: vi.fn() }),
  }),
}));

vi.mock("../../stores/dragStore", () => ({
  useDragStore: () => false,
}));

vi.mock("../../stores/modalStore", () => ({
  useModalStore: { getState: () => ({ open: vi.fn() }) },
}));

vi.mock("../MiniPlaylistCard", () => ({
  default: ({ playlistImage }: { playlistImage: { image_id: number } }) => (
    <div data-testid={`mini-card-${playlistImage.image_id}`}>MiniCard</div>
  ),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import PlaylistTrack from "../PlaylistTrack";

beforeEach(() => {
  vi.clearAllMocks();
  mockPlaylist = {
    id: null,
    name: "",
    configuration: {
      type: "timer",
      interval: 300,
      order: "ordered",
      always_start_on_first_image: false,
    },
    images: [],
  };
  mockIsDirty = false;
});

describe("PlaylistTrack", () => {
  it("renders title and basic buttons for an empty playlist", () => {
    render(<PlaylistTrack />);

    expect(screen.getByText("Playlist")).toBeInTheDocument();
    expect(screen.getByText("Add images")).toBeInTheDocument();
    expect(screen.getByText("Load Playlist")).toBeInTheDocument();
    expect(screen.getByText("Random Image")).toBeInTheDocument();

    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.queryByText("Configure")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("renders playlist count and extra buttons when images exist", () => {
    mockPlaylist.images = [{ image_id: 1 }, { image_id: 2 }, { image_id: 3 }];
    mockIsDirty = false;

    render(<PlaylistTrack />);

    expect(screen.getByText("Playlist (3)")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();

    expect(screen.getByTestId("mini-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("mini-card-2")).toBeInTheDocument();
    expect(screen.getByTestId("mini-card-3")).toBeInTheDocument();
  });
});
