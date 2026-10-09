import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";
import type { UnifiedConfig } from "../../../shared/types/unifiedConfig";

type FakeTransition = {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
  skip: () => void;
};

/** Mimics Chromium: runs the update, then settles (or rejects, like a skipped transition). */
function stubViewTransitions() {
  const transitions: FakeTransition[] = [];
  const start = vi.fn((update: () => void) => {
    update();
    let skip!: () => void;
    const finished = new Promise<void>((_resolve, reject) => {
      skip = () => reject(new DOMException("Transition was skipped", "AbortError"));
    });
    const t = { ready: finished, updateCallbackDone: finished, finished, skip };
    transitions.push(t);
    return t;
  });
  Object.defineProperty(document, "startViewTransition", { value: start, configurable: true });
  return { start, transitions };
}

function setConfigTheme(theme: string) {
  const config = useSettingsStore.getState().config!;
  act(() => {
    useSettingsStore.setState({ config: { ...config, app: { ...config.app, theme } } });
  });
}

const baseConfig = {
  app: { theme: "kolision-raw" },
  daemon: {},
  backend: {},
  monitors: {},
  wallhaven: {},
} as unknown as UnifiedConfig;

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "kolision-raw");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    useSettingsStore.setState({ config: baseConfig });
  });

  afterEach(() => {
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  it("follows theme changes from the settings store", () => {
    render(<ThemeProvider defaultTheme="kolision-raw">{null}</ThemeProvider>);

    setConfigTheme("nord");

    expect(document.documentElement.getAttribute("data-theme")).toBe("nord");
  });

  it("does nothing when the config reports the theme already shown", () => {
    const { start } = stubViewTransitions();
    render(<ThemeProvider defaultTheme="kolision-raw">{null}</ThemeProvider>);

    setConfigTheme("nord");
    setConfigTheme("nord");
    act(() => {
      useSettingsStore.setState({ config: { ...useSettingsStore.getState().config! } });
    });

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("swaps instantly without a transition while the window is hidden", () => {
    const { start } = stubViewTransitions();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    render(<ThemeProvider defaultTheme="kolision-raw">{null}</ThemeProvider>);

    setConfigTheme("nord");

    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-theme")).toBe("nord");
  });

  it("runs one transition at a time and swallows skipped-transition errors", async () => {
    const { start, transitions } = stubViewTransitions();
    render(<ThemeProvider defaultTheme="kolision-raw">{null}</ThemeProvider>);

    setConfigTheme("nord");
    setConfigTheme("dracula");
    transitions[0].skip();
    await Promise.resolve();

    expect(start).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dracula");
  });
});
