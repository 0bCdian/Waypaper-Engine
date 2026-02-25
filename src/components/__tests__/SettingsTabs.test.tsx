import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetSearchTerm = vi.fn();
const mockClearSearch = vi.fn();
const mockClearErrors = vi.fn();
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

beforeEach(() => {
  vi.clearAllMocks();
  mockErrors = [];
  mockFilteredSections = ["app", "daemon", "backend", "wallhaven"];
});

describe("SettingsTabs", () => {
  it("renders all four section tabs", () => {
    render(<SettingsTabs />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Daemon")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Wallhaven")).toBeInTheDocument();
  });

  it("clicking a tab switches the active section", async () => {
    const user = userEvent.setup();
    render(<SettingsTabs />);

    expect(screen.getByTestId("app-settings")).toBeInTheDocument();

    await user.click(screen.getByText("Daemon"));

    expect(screen.getByTestId("daemon-settings")).toBeInTheDocument();
  });

  it("shows error count badge when errors exist", () => {
    mockErrors = ["field is required", "invalid value"];

    render(<SettingsTabs />);

    expect(screen.getByText("2 errors")).toBeInTheDocument();
  });

  it("only renders tabs for filteredSections", () => {
    mockFilteredSections = ["app", "daemon"];

    render(<SettingsTabs />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Daemon")).toBeInTheDocument();
    expect(screen.queryByText("Backend")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallhaven")).not.toBeInTheDocument();
  });
});
