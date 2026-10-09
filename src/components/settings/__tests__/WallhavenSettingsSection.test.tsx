import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      config: { wallhaven: { api_key: "", enabled: true, blur_nsfw_thumbnails: true } },
      saveConfigSection: save,
    }),
}));
vi.mock("@/components/WallhavenDisclaimerModal", () => ({ WallhavenDisclaimerModal: () => null }));

import WallhavenSettingsSection from "../sections/WallhavenSettingsSection";

describe("Wallhaven API key", () => {
  beforeEach(() => save.mockReset());

  it("saves once on blur, not per keystroke", () => {
    render(<WallhavenSettingsSection />);
    const input = screen.getByPlaceholderText("Enter your Wallhaven API key");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    expect(save).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("wallhaven", { api_key: "ab" });
  });
});
