import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ resolve: () => {} }));
const setWallpaper = vi.hoisted(() =>
  vi.fn(
    () =>
      new Promise<void>((r) => {
        h.resolve = r;
      }),
  ),
);
vi.mock("@/client", () => ({
  daemonClient: { setWallpaper, on: () => () => {} },
}));
vi.mock("../../stores/historyStore", () => {
  const state = {
    entries: [
      {
        id: "1",
        image_id: 1,
        image_name: "pic",
        mode: "individual",
        monitors: ["DP-1"],
        set_at: new Date().toISOString(),
        source: { type: "manual" },
      },
    ],
    imageCache: new Map(),
    isLoading: false,
    hasMore: false,
    fetchHistory: () => {},
    loadMore: () => {},
    clearHistory: () => {},
  };
  const useHistoryStore = (sel: (s: unknown) => unknown) => sel(state);
  useHistoryStore.getState = () => state;
  return { useHistoryStore };
});

import History from "../History";

describe("History row", () => {
  it("is disabled and busy while applying", async () => {
    render(<History />);
    const row = screen.getByRole("button", { name: /pic/ });
    fireEvent.click(row);
    fireEvent.click(row);
    expect(setWallpaper).toHaveBeenCalledTimes(1);
    expect(row).toBeDisabled();
    expect(row).toHaveAttribute("aria-busy", "true");
    h.resolve();
    await waitFor(() => expect(row).not.toBeDisabled());
  });
});
