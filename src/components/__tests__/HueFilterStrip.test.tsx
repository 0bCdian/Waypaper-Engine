import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HUE_GROUPS } from "../HueFilterStrip";

const mockSetFilters = vi.fn();
const mockFetchPage = vi.fn();

const mockImagesState = {
  filters: {
    hueGroup: null as number | null,
  },
};

vi.mock("../../stores/images", () => ({
  useImagesStore: Object.assign(
    (selector: (s: typeof mockImagesState) => unknown) => selector(mockImagesState),
    {
      getState: () => ({
        fetchPage: mockFetchPage,
        filters: mockImagesState.filters,
        setFilters: mockSetFilters,
      }),
    },
  ),
}));

import HueFilterStrip from "../HueFilterStrip";

beforeEach(() => {
  vi.clearAllMocks();
  mockImagesState.filters.hueGroup = null;
});

describe("HUE_GROUPS", () => {
  it("has 12 hue buckets plus neutral", () => {
    expect(HUE_GROUPS).toHaveLength(13);
    expect(HUE_GROUPS.map((g) => g.value)).toEqual([...Array(12).keys(), 99]);
  });

  it("centers group k at k*30 degrees", () => {
    expect(HUE_GROUPS[0].color).toBe("hsl(0 65% 45%)");
    expect(HUE_GROUPS[8].color).toBe("hsl(240 65% 45%)");
    expect(HUE_GROUPS[12].color).toBe("hsl(0 0% 45%)");
  });
});

describe("HueFilterStrip", () => {
  it("clicking a swatch sets filters.hueGroup and fetches page 1", async () => {
    const user = userEvent.setup();
    render(<HueFilterStrip />);

    await user.click(screen.getByRole("button", { name: "Filter by red" }));

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ hueGroup: 0 }));
    expect(mockFetchPage).toHaveBeenCalledWith(1);
  });

  it("clicking the selected swatch again clears the filter to null", async () => {
    const user = userEvent.setup();
    mockImagesState.filters.hueGroup = 0;
    render(<HueFilterStrip />);

    await user.click(screen.getByRole("button", { name: "Filter by red" }));

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ hueGroup: null }));
  });
});
