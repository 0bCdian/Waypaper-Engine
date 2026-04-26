import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetFilters = vi.fn();
const mockFetchPage = vi.fn();
const mockModalOpen = vi.fn();

const mockImagesState = {
  setFilters: mockSetFilters,
  filters: {
    order: "desc" as "asc" | "desc",
    type: "id" as "name" | "id",
    mediaType: "all" as const,
    filterTokens: [] as string[],
    advancedFilters: {
      resolution: { constraint: "all" as const, width: 0, height: 0 },
    },
  },
};

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign(
    (selector: (s: typeof mockImagesState) => unknown) => selector(mockImagesState),
    { getState: () => ({ fetchPage: mockFetchPage, filters: mockImagesState.filters }) },
  ),
}));

vi.mock("../../stores/modalStore", () => ({
  useModalStore: { getState: () => ({ open: mockModalOpen }) },
}));

vi.mock("../../hooks/useIsNeo", () => ({
  useIsNeo: () => false,
}));

vi.mock("../../hooks/useDebounce", () => ({
  default: (callback: () => void) => callback(),
}));

import { GALLERY_FILTER_INPUT_HISTORY_KEY } from "../../utils/galleryFilterInputHistory";
import Filters from "../Filters";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(GALLERY_FILTER_INPUT_HISTORY_KEY);
  mockImagesState.filters.filterTokens = [];
  mockImagesState.filters.order = "desc";
  mockImagesState.filters.type = "id";
  mockImagesState.filters.mediaType = "all";
});

describe("Filters", () => {
  it("renders token filter, sort button, media buttons, and Filters control", async () => {
    render(<Filters />);

    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    // Default state: type="id", order="desc" → "ID ↓"
    expect(screen.getByText("ID ↓")).toBeInTheDocument();
    expect(screen.getByText("GIF")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("clicking Filters button calls modalStore open with AdvancedFiltersModal", async () => {
    const user = userEvent.setup();
    render(<Filters />);

    await user.click(screen.getByText("Filters"));
    expect(mockModalOpen).toHaveBeenCalledWith("AdvancedFiltersModal");
  });

  it("syntax help opens GalleryFilterCheatsheetModal", async () => {
    const user = userEvent.setup();
    render(<Filters />);

    await user.click(screen.getByRole("button", { name: "Filter syntax help" }));
    expect(mockModalOpen).toHaveBeenCalledWith("GalleryFilterCheatsheetModal");
  });

  it("clear search and history button clears filterTokens and input history", async () => {
    const user = userEvent.setup();
    mockImagesState.filters.filterTokens = ["q:mountains", "tag:nature"];

    render(<Filters />);

    await user.click(screen.getByRole("button", { name: "Clear search and history" }));

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        filterTokens: [],
        advancedFilters: mockImagesState.filters.advancedFilters,
      }),
    );
    expect(mockFetchPage).toHaveBeenCalled();
    expect(localStorage.getItem(GALLERY_FILTER_INPUT_HISTORY_KEY)).toBeNull();
  });

  it("clear search and history button appears when history is present and clears it", async () => {
    const user = userEvent.setup();
    localStorage.setItem(GALLERY_FILTER_INPUT_HISTORY_KEY, JSON.stringify(["q:old", "tag:keep"]));

    render(<Filters />);

    await user.click(screen.getByRole("button", { name: "Clear search and history" }));

    expect(localStorage.getItem(GALLERY_FILTER_INPUT_HISTORY_KEY)).toBeNull();
  });

  it("sort button reflects persisted store order and type", () => {
    mockImagesState.filters.order = "asc";
    mockImagesState.filters.type = "name";

    render(<Filters />);

    expect(screen.getByText("Name ↑")).toBeInTheDocument();
  });

  it("keydown / focuses the gallery filter combobox", async () => {
    const { container } = render(<Filters />);
    const combobox = await screen.findByRole("combobox");
    const sink = document.createElement("div");
    sink.tabIndex = 0;
    container.appendChild(sink);
    sink.focus();
    expect(sink).toHaveFocus();

    fireEvent.keyDown(sink, { key: "/", bubbles: true });

    await waitFor(() => {
      expect(combobox).toHaveFocus();
    });
  });

  it("keydown / does not steal focus from a textarea", async () => {
    render(
      <>
        <textarea data-testid="other-field" />
        <Filters />
      </>,
    );
    const combobox = await screen.findByRole("combobox");
    const ta = screen.getByTestId("other-field");
    ta.focus();
    expect(ta).toHaveFocus();

    fireEvent.keyDown(ta, { key: "/", bubbles: true });

    expect(ta).toHaveFocus();
    expect(combobox).not.toHaveFocus();
  });

  it("after selecting a saved search chip, other history rows still appear in the menu", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      GALLERY_FILTER_INPUT_HISTORY_KEY,
      JSON.stringify(["q:alpha", "q:beta", "q:gamma"]),
    );
    render(<Filters />);
    const combobox = await screen.findByRole("combobox");
    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "q:beta" }));
    await waitFor(() => {
      expect(screen.getByText("q:beta")).toBeInTheDocument();
    });
    await user.click(combobox);
    expect(await screen.findByRole("option", { name: "q:alpha" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "q:gamma" })).toBeInTheDocument();
  });

  it("does not show a menu or No options when history is empty", async () => {
    const user = userEvent.setup();
    render(<Filters />);
    const combobox = await screen.findByRole("combobox");
    await user.click(combobox);
    expect(screen.queryByText(/no options/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keydown / is ignored while a dialog is open", async () => {
    const { container } = render(<Filters />);
    const combobox = await screen.findByRole("combobox");
    const sink = document.createElement("div");
    sink.tabIndex = 0;
    container.appendChild(sink);
    sink.focus();

    const dlg = document.createElement("dialog");
    dlg.setAttribute("open", "");
    document.body.appendChild(dlg);

    try {
      fireEvent.keyDown(sink, { key: "/", bubbles: true });
      expect(sink).toHaveFocus();
      expect(combobox).not.toHaveFocus();
    } finally {
      dlg.remove();
    }
  });
});
