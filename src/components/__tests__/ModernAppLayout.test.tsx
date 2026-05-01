import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("../StartupIntro", async () => {
  const React = await import("react");
  const MockStartupIntro = ({ onFinish }: { onFinish: () => void }) => {
    React.useEffect(() => {
      queueMicrotask(() => {
        onFinish();
      });
    }, [onFinish]);
    return null;
  };
  return { default: MockStartupIntro };
});

import { ModernAppLayout } from "../layout/ModernAppLayout";

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
});
