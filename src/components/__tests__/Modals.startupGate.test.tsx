import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useStartupIntroGateStore } from "../../stores/startupIntroGateStore";

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: (...args: unknown[]) => unknown) => fn,
}));

const openSpy = vi.fn();

const mockSetLastSaved = vi.fn().mockResolvedValue(undefined);
const mockReQuery = vi.fn().mockResolvedValue(undefined);

vi.mock("../../stores/modalStore", () => ({
  useModalStore: {
    getState: () => ({
      open: openSpy,
      close: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
    }),
  },
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: (selector: (s: { config: unknown }) => unknown) =>
    selector({
      config: {
        app: { show_monitor_modal_on_start: true },
      },
    }),
}));

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: (selector: (s: { playlist: { name: string } }) => unknown) =>
    selector({ playlist: { name: "p" } }),
}));

vi.mock("../../stores/monitors", () => ({
  useMonitorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setLastSavedMonitorConfig: mockSetLastSaved,
      reQueryMonitors: mockReQuery,
    }),
}));

vi.mock("@/client", () => ({
  daemonClient: {
    getPlaylists: vi.fn().mockResolvedValue([]),
    on: vi.fn(() => () => {}),
  },
}));

vi.mock("../settings/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("../LoadPlaylistModal", () => ({ default: () => null }));
vi.mock("../SavePlaylistModal", () => ({ default: () => null }));
vi.mock("../AddToPlaylistModal", () => ({ default: () => null }));
vi.mock("../PlaylistConfigurationModal", () => ({ default: () => null }));
vi.mock("../AdvancedFiltersModal", () => ({ default: () => null }));
vi.mock("../GalleryFilterCheatsheetModal", () => ({ default: () => null }));
vi.mock("../FolderImportModal", () => ({ default: () => null }));
vi.mock("../FolderPickerModal", () => ({ default: () => null }));
vi.mock("../MonitorsModal", () => ({ default: () => null }));

import Modals from "../Modals";

describe("Modals startup gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStartupIntroGateStore.setState({ introFinished: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not open monitors modal until startup intro has finished", async () => {
    render(<Modals />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(openSpy).not.toHaveBeenCalled();

    await act(async () => {
      useStartupIntroGateStore.setState({ introFinished: true });
    });

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockSetLastSaved).toHaveBeenCalled();
    expect(mockReQuery).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith("monitors");
  });
});
