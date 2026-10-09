import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { updateImage, getImage, confirmDialog } = vi.hoisted(() => ({
  updateImage: vi.fn(),
  getImage: vi.fn(),
  confirmDialog: vi.fn(),
}));

vi.mock("@/client", () => ({
  daemonClient: new Proxy(
    { updateImage, getImage },
    { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? vi.fn().mockResolvedValue([]) },
  ),
}));
vi.mock("../ConfirmDialog", () => ({ confirmDialog }));

import ImageDetailSidebar from "../ImageDetailSidebar";
import { useImageDetailStore } from "../../stores/imageDetailStore";

const image = {
  id: 7,
  name: "pic.png",
  media_type: "image",
  format: "png",
  tags: ["a"],
  colors: [],
  width: 10,
  height: 10,
} as never;

function setup() {
  render(
    <MemoryRouter>
      <ImageDetailSidebar />
    </MemoryRouter>,
  );
  act(() => useImageDetailStore.getState().open({ ...(image as object) } as never));
}

describe("ImageDetailSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateImage.mockResolvedValue({});
    getImage.mockResolvedValue(image);
  });

  it("closes without confirm when nothing changed", async () => {
    setup();
    fireEvent.click(screen.getByLabelText("close sidebar"));
    await waitFor(() => expect(useImageDetailStore.getState().isOpen).toBe(false));
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it("confirms before discarding unsaved edits", async () => {
    confirmDialog.mockResolvedValue(false);
    setup();
    fireEvent.click(screen.getByLabelText("Remove tag a"));
    fireEvent.click(screen.getByLabelText("close sidebar"));
    await waitFor(() => expect(confirmDialog).toHaveBeenCalledOnce());
    expect(useImageDetailStore.getState().isOpen).toBe(true);
  });

  it("saves pending tag input", async () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/tag/i), { target: { value: " What " } });
    fireEvent.click(screen.getByText("Save details"));
    await waitFor(() =>
      expect(updateImage).toHaveBeenCalledWith(7, { tags: ["a", "what"], colors: [] }),
    );
  });
});
