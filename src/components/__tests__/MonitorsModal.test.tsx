import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockSetMonitorsList = vi.fn();
const mockSetMonitorSelection = vi.fn();
const mockRefreshFromDaemon = vi.fn().mockResolvedValue(undefined);

let mockMonitorsList: {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  refresh_rate: number;
  transform: number;
  isSelected: boolean;
}[] = [];

let mockMonitorSelection = {
  selectedMonitors: [] as string[],
  mode: "individual" as "individual" | "clone" | "extend",
};

vi.mock("../../stores/monitors", () => ({
  useMonitorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      monitorSelection: mockMonitorSelection,
      monitorsList: mockMonitorsList,
      setMonitorsList: mockSetMonitorsList,
      setMonitorSelection: mockSetMonitorSelection,
      refreshFromDaemon: mockRefreshFromDaemon,
    }),
}));

vi.mock("../../stores/modalStore", () => ({
  useModalStore: {
    getState: () => ({
      register: vi.fn(),
      unregister: vi.fn(),
      open: vi.fn(),
    }),
  },
}));

vi.mock("../Monitor", () => ({
  MonitorComponent: ({ monitor }: { monitor: { name: string } }) => (
    <div data-testid={`monitor-${monitor.name}`}>{monitor.name}</div>
  ),
}));

vi.mock("../../utils/utilities", () => ({
  calculateMinResolution: () => ({ x: 1920, y: 1080 }),
}));

HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal ?? vi.fn();
HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close ?? vi.fn();

import Monitors from "../MonitorsModal";

function makeMonitor(
  name: string,
  isSelected: boolean,
  x = 0,
  y = 0,
): (typeof mockMonitorsList)[number] {
  return {
    name,
    width: 1920,
    height: 1080,
    x,
    y,
    scale: 1,
    refresh_rate: 60,
    transform: 0,
    isSelected,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMonitorsList = [];
  mockMonitorSelection = { selectedMonitors: [], mode: "individual" };
});

describe("MonitorsModal", () => {
  it("renders title and display mode dropdown", () => {
    mockMonitorsList = [makeMonitor("HDMI-A-1", false)];

    render(<Monitors />);

    expect(screen.getByText("Choose Display")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Wallpaper per display")).toBeInTheDocument();
    expect(screen.getByText("Stretch single wallpaper")).toBeInTheDocument();
    expect(screen.getByText("Clone single wallpaper")).toBeInTheDocument();
  });

  it("renders monitor entries from store", () => {
    mockMonitorsList = [makeMonitor("HDMI-A-1", false), makeMonitor("DP-1", false, 1920, 0)];

    render(<Monitors />);

    expect(screen.getByTestId("monitor-HDMI-A-1")).toBeInTheDocument();
    expect(screen.getByTestId("monitor-DP-1")).toBeInTheDocument();
  });

  it("shows error when no monitors selected and Save clicked", async () => {
    const user = userEvent.setup();
    mockMonitorsList = [makeMonitor("HDMI-A-1", false)];

    render(<Monitors />);

    await user.click(screen.getByRole("button", { name: "Save", hidden: true }));

    await waitFor(() => {
      expect(screen.getByText("Select at least one display")).toBeInTheDocument();
    });
  });

  it("shows error about needing 2+ displays in clone mode", async () => {
    const user = userEvent.setup();
    mockMonitorsList = [makeMonitor("HDMI-A-1", true)];
    mockMonitorSelection = { selectedMonitors: [], mode: "clone" };

    render(<Monitors />);

    const dropdown = screen.getByRole("combobox", { hidden: true });
    await user.selectOptions(dropdown, "clone");
    await user.click(screen.getByRole("button", { name: "Save", hidden: true }));

    await waitFor(() => {
      expect(screen.getByText("Select at least two displays")).toBeInTheDocument();
    });
  });

  it("calls setMonitorSelection on valid individual submit", async () => {
    const user = userEvent.setup();
    mockMonitorsList = [makeMonitor("HDMI-A-1", true)];

    render(<Monitors />);

    await user.click(screen.getByRole("button", { name: "Save", hidden: true }));

    await waitFor(() => {
      expect(mockSetMonitorSelection).toHaveBeenCalledWith({
        selectedMonitors: ["HDMI-A-1"],
        mode: "individual",
      });
    });
  });
});
