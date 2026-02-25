import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetFilters = vi.fn();
const mockFetchPage = vi.fn();
const mockModalOpen = vi.fn();

const mockImagesState = {
  setFilters: mockSetFilters,
  filters: {
    order: "desc" as const,
    type: "id" as const,
    searchString: "",
    tags: [],
    advancedFilters: {
      formats: [],
      resolution: { constraint: "all" as const, width: 0, height: 0 },
      colors: [],
    },
  },
};

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign(
    (selector: (s: typeof mockImagesState) => unknown) => selector(mockImagesState),
    { getState: () => ({ fetchPage: mockFetchPage }) },
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

import Filters from "../Filters";

beforeEach(() => {
  vi.clearAllMocks();
  (window.API_RENDERER.goDaemon.getImageTags as ReturnType<typeof vi.fn>).mockResolvedValue({
    tags: [],
  });
});

describe("Filters", () => {
  it("renders search input, sort toggles, and tags button", () => {
    render(<Filters />);

    expect(screen.getByPlaceholderText("Search or #tag")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Asc")).toBeInTheDocument();
    expect(screen.getByText("Desc")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("typing in search input updates its value", async () => {
    const user = userEvent.setup();
    render(<Filters />);

    const input = screen.getByPlaceholderText("Search or #tag");
    await user.type(input, "sunset");

    expect(input).toHaveValue("sunset");
  });

  it("toggling Name/ID swap renders both labels", () => {
    render(<Filters />);

    const swapOn = screen.getByText("Name");
    const swapOff = screen.getByText("ID");
    expect(swapOn).toBeInTheDocument();
    expect(swapOff).toBeInTheDocument();
    expect(swapOn.className).toContain("swap-on");
    expect(swapOff.className).toContain("swap-off");
  });

  it("toggling Asc/Desc swap renders both labels", () => {
    render(<Filters />);

    const swapOn = screen.getByText("Asc");
    const swapOff = screen.getByText("Desc");
    expect(swapOn).toBeInTheDocument();
    expect(swapOff).toBeInTheDocument();
    expect(swapOn.className).toContain("swap-on");
    expect(swapOff.className).toContain("swap-off");
  });

  it("clicking Filters button calls modalStore open with AdvancedFiltersModal", async () => {
    const user = userEvent.setup();
    render(<Filters />);

    await user.click(screen.getByText("Filters"));
    expect(mockModalOpen).toHaveBeenCalledWith("AdvancedFiltersModal");
  });

  it("opening tags dropdown fetches tags from daemon", async () => {
    const user = userEvent.setup();
    render(<Filters />);

    await user.click(screen.getByText("Tags"));

    await waitFor(() => {
      expect(window.API_RENDERER.goDaemon.getImageTags).toHaveBeenCalled();
    });
  });

  it("selecting a tag shows it as a badge", async () => {
    (window.API_RENDERER.goDaemon.getImageTags as ReturnType<typeof vi.fn>).mockResolvedValue({
      tags: ["nature", "city", "abstract"],
    });

    const user = userEvent.setup();
    render(<Filters />);

    await user.click(screen.getByText("Tags"));

    await waitFor(() => {
      expect(screen.getByText("nature")).toBeInTheDocument();
    });

    await user.click(screen.getByText("nature"));

    expect(screen.getByText(/nature/)).toBeInTheDocument();
    const badge = screen.getByText(/nature/).closest(".badge");
    expect(badge).not.toBeNull();
  });
});
