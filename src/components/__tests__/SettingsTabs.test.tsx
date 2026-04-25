import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SETTINGS_ACTIVE_SECTION_STORAGE_KEY } from "@/utils/settingsNavStorage";

const mockSetSearchTerm = vi.fn();
const mockClearSearch = vi.fn();
const mockClearErrors = vi.fn();
const mockSetPendingBackendSettingsTab = vi.fn();
let mockErrors: string[] = [];
let mockFilteredSections = ["app", "daemon", "backend", "wallhaven"];

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: Function) => fn,
}));

vi.mock("@/hooks/useIsNeo", () => ({ useIsNeo: () => false }));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: Function) =>
    selector({
      errors: mockErrors,
      searchTerm: "",
      filteredSections: mockFilteredSections,
      setSearchTerm: mockSetSearchTerm,
      clearSearch: mockClearSearch,
      clearErrors: mockClearErrors,
      setPendingBackendSettingsTab: mockSetPendingBackendSettingsTab,
    }),
}));

vi.mock("../settings/SettingsSearch", () => ({
  default: () => <div data-testid="settings-search">Search</div>,
}));

vi.mock("../settings/sections/AppSettingsSection", () => ({
  default: () => <div data-testid="app-settings">App Settings</div>,
}));

vi.mock("../settings/sections/DaemonSettingsSection", () => ({
  default: () => <div data-testid="daemon-settings">Daemon Settings</div>,
}));

vi.mock("../settings/sections/BackendSettingsSection", () => ({
  default: () => <div data-testid="backend-settings">Backend Settings</div>,
}));

vi.mock("../settings/sections/WallhavenSettingsSection", () => ({
  default: () => <div data-testid="wallhaven-settings">Wallhaven Settings</div>,
}));

vi.mock("@/utils/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { SettingsTabs } from "../settings/SettingsTabs";

function renderWithRouter(
  ui: ReactElement,
  initialEntries: { pathname: string; state?: unknown }[] = [{ pathname: "/settings" }],
) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

let lsStore: Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  mockErrors = [];
  mockFilteredSections = ["app", "daemon", "backend", "wallhaven"];
  lsStore = {};
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => (key in lsStore ? lsStore[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      lsStore[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete lsStore[key];
    }),
    clear: vi.fn(() => {
      lsStore = {};
    }),
  });
});

describe("SettingsTabs", () => {
  it("renders all four section tabs", () => {
    renderWithRouter(<SettingsTabs />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Daemon")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Wallhaven")).toBeInTheDocument();
  });

  it("clicking a tab switches the active section", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SettingsTabs />);

    expect(screen.getByTestId("app-settings")).toBeInTheDocument();

    await user.click(screen.getByText("Daemon"));

    expect(screen.getByTestId("daemon-settings")).toBeInTheDocument();
  });

  it("clears pending backend sub-tab when opening Backend from nav", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SettingsTabs />);
    await user.click(screen.getByText("Backend"));
    expect(mockSetPendingBackendSettingsTab).toHaveBeenCalledWith(null);
  });

  it("shows error count badge when errors exist", () => {
    mockErrors = ["field is required", "invalid value"];

    renderWithRouter(<SettingsTabs />);

    expect(screen.getByText("2 errors")).toBeInTheDocument();
  });

  it("only renders tabs for filteredSections", () => {
    mockFilteredSections = ["app", "daemon"];

    renderWithRouter(<SettingsTabs />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Daemon")).toBeInTheDocument();
    expect(screen.queryByText("Backend")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallhaven")).not.toBeInTheDocument();
  });

  it("hydrates active section from localStorage", () => {
    lsStore[SETTINGS_ACTIVE_SECTION_STORAGE_KEY] = "daemon";

    renderWithRouter(<SettingsTabs />);

    expect(screen.getByTestId("daemon-settings")).toBeInTheDocument();
  });

  it("persists active section to localStorage when tab changes", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SettingsTabs />);

    await user.click(screen.getByText("Wallhaven"));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      SETTINGS_ACTIVE_SECTION_STORAGE_KEY,
      "wallhaven",
    );
  });

  it("ignores invalid localStorage value and defaults to General", () => {
    lsStore[SETTINGS_ACTIVE_SECTION_STORAGE_KEY] = "not-a-section";

    renderWithRouter(<SettingsTabs />);

    expect(screen.getByTestId("app-settings")).toBeInTheDocument();
  });

  it("clamps active section when filteredSections excludes persisted section", async () => {
    lsStore[SETTINGS_ACTIVE_SECTION_STORAGE_KEY] = "backend";
    mockFilteredSections = ["app", "daemon"];

    renderWithRouter(<SettingsTabs />);

    await waitFor(() => {
      expect(screen.getByTestId("app-settings")).toBeInTheDocument();
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(SETTINGS_ACTIVE_SECTION_STORAGE_KEY, "app");
  });

  it("opens Wallhaven tab when navigation state requests it", async () => {
    renderWithRouter(<SettingsTabs />, [
      { pathname: "/settings", state: { settingsNavSection: "wallhaven" } },
    ]);
    await waitFor(() => {
      expect(screen.getByTestId("wallhaven-settings")).toBeInTheDocument();
    });
  });
});
