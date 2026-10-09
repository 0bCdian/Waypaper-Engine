import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ currentTheme: "dark", isDarkMode: true }),
}));

vi.mock("../layout/ModernSidebar", () => ({
  IconRailSidebar: () => <div data-testid="icon-rail">IconRail</div>,
}));

vi.mock("../../utils/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
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

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false as boolean | null,
}));

vi.mock("../StartupIntro", () => ({
  StartupIntro: ({ onFinish }: { onFinish: () => void }) => (
    <button type="button" data-testid="intro" onClick={onFinish}>
      intro
    </button>
  ),
}));

import { ModernAppLayout } from "../layout/ModernAppLayout";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockConfig = {
    app: {},
    daemon: {},
    backend: {},
    monitors: {},
    wallhaven: {},
  };
});

describe("ModernAppLayout", () => {
  it("renders shell when config has not arrived yet", () => {
    mockConfig = null;
    render(<ModernAppLayout>Content</ModernAppLayout>);
    expect(screen.getByTestId("icon-rail")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders icon rail and children when config is loaded", () => {
    render(
      <ModernAppLayout>
        <p>Hello world</p>
      </ModernAppLayout>,
    );
    expect(screen.getByTestId("icon-rail")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  describe("startup intro", () => {
    it("plays on first launch", () => {
      render(<ModernAppLayout>Content</ModernAppLayout>);
      expect(screen.getByTestId("intro")).toBeInTheDocument();
    });

    it("remembers that it played", () => {
      render(<ModernAppLayout>Content</ModernAppLayout>);
      fireEvent.click(screen.getByTestId("intro"));

      expect(screen.queryByTestId("intro")).not.toBeInTheDocument();
      expect(localStorage.getItem("waypaper-intro-played")).toBe("1");
    });

    it("does not play again on later launches", () => {
      localStorage.setItem("waypaper-intro-played", "1");
      render(<ModernAppLayout>Content</ModernAppLayout>);
      expect(screen.queryByTestId("intro")).not.toBeInTheDocument();
    });

    it("never plays when startup_intro is off", () => {
      mockConfig = { ...mockConfig, app: { startup_intro: false } };
      render(<ModernAppLayout>Content</ModernAppLayout>);
      expect(screen.queryByTestId("intro")).not.toBeInTheDocument();
    });
  });
});
