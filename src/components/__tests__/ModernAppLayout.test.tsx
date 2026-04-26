import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ currentTheme: "dark", isDarkMode: true }),
}));

vi.mock("../layout/TitleBar", () => ({
  default: () => <div data-testid="navbar">TitleBar</div>,
}));

vi.mock("../layout/ModernSidebar", () => ({
  SidebarContent: () => <div data-testid="sidebar">Sidebar</div>,
  IconRailSidebar: () => <div data-testid="icon-rail">IconRail</div>,
}));

vi.mock("../UrlImportWarningModal", () => ({
  UrlImportWarningModal: () => null,
}));

vi.mock("../../hooks/useOpenImages", () => ({
  default: { getState: () => ({ importDroppedDirectory: vi.fn() }) },
}));

vi.mock("../../utils/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockSyncToDOM = vi.fn();
let mockConfig: Record<string, unknown> | null = {
  app: {},
  daemon: {},
  backend: {},
  monitors: {},
  wallhaven: {},
};

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: (selector: Function) => selector({ config: mockConfig }),
}));

vi.mock("../../stores/designSystemStore", () => ({
  useDesignSystemStore: (selector: Function) => selector({ syncToDOM: mockSyncToDOM }),
}));

vi.mock("../../stores/foldersStore", () => ({
  useFoldersStore: { getState: () => ({ currentFolderId: null as number | null }) },
}));

import { ModernAppLayout, DRAWER_CHECKBOX_ID } from "../layout/ModernAppLayout";

beforeEach(() => {
  vi.clearAllMocks();
  mockConfig = {
    app: {},
    daemon: {},
    backend: {},
    monitors: {},
    wallhaven: {},
  };
});

describe("ModernAppLayout", () => {
  it("shows loading spinner when config is null", () => {
    mockConfig = null;

    const { container } = render(<ModernAppLayout>Content</ModernAppLayout>);

    expect(container.querySelector(".loading-spinner")).toBeInTheDocument();
    expect(screen.queryAllByTestId("navbar")).toHaveLength(0);
  });

  it("renders TitleBar and children when config is loaded", () => {
    render(
      <ModernAppLayout>
        <p>Hello world</p>
      </ModernAppLayout>,
    );

    expect(screen.getAllByTestId("navbar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hello world").length).toBeGreaterThan(0);
  });

  it("renders sidebar drawer structure", () => {
    const { container } = render(<ModernAppLayout>Content</ModernAppLayout>);

    const toggle = container.querySelector(`input#${DRAWER_CHECKBOX_ID}.drawer-toggle`);
    expect(toggle).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
