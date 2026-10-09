// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WindowManager } from "./WindowManager";

const { FakeWindow, localApp, daemonListeners, getConfig } = vi.hoisted(() => {
  class FakeWindow {
    handlers = new Map<string, (...args: unknown[]) => void>();
    hide = vi.fn();
    show = vi.fn();
    on(event: string, cb: (...args: unknown[]) => void) {
      this.handlers.set(event, cb);
    }
    once(event: string, cb: (...args: unknown[]) => void) {
      this.handlers.set(event, cb);
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }
  }
  return {
    FakeWindow,
    localApp: { start_minimized: true, minimize_instead_of_close: false },
    daemonListeners: new Map<string, () => void>(),
    getConfig: vi.fn(),
  };
});
type FakeWindow = InstanceType<typeof FakeWindow>;

vi.mock("electron", () => ({ BrowserWindow: FakeWindow, app: {} }));
vi.mock("../../globals/configReader", () => ({
  configReader: { loadConfig: () => ({ app: localApp }) },
}));
vi.mock("../goDaemonClient", () => ({
  goDaemonClient: {
    on: (event: string, cb: () => void) => daemonListeners.set(event, cb),
    control: { getConfig },
  },
}));
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));

describe("WindowManager", () => {
  beforeEach(() => getConfig.mockReset());

  it("honours start_minimized from the local config file without asking the daemon", () => {
    const win = new WindowManager().createWindow() as unknown as FakeWindow;
    win.emit("ready-to-show");

    expect(win.hide).toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("picks up close-to-tray changes from config_changed", async () => {
    getConfig.mockResolvedValue({ app: { minimize_instead_of_close: true } });
    const win = new WindowManager().createWindow() as unknown as FakeWindow;

    daemonListeners.get("config_changed")?.();
    await vi.waitFor(() => expect(getConfig).toHaveBeenCalled());
    await Promise.resolve();

    const preventDefault = vi.fn();
    win.emit("close", { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(win.hide).toHaveBeenCalled();
  });
});
