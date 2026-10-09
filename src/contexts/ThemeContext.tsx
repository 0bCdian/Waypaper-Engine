import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { ThemeContextType } from "./types";
import type { ThemeMeta } from "../themes/types";
import { themes, findTheme } from "../themes/themes";
import { logger } from "../utils/logger";
import { useSettingsStore } from "../stores/settingsStore";

type ViewTransitionLike = {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
};

const DEFAULT_THEME_NAME = "kolision-raw";

function hasThemeFn(name: string): boolean {
  return themes.some((t) => t.name === name);
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem("waypaper-theme");
  } catch {
    return null;
  }
}

function resolveInitialTheme(defaultTheme: string, persist: boolean): string {
  if (!persist) return defaultTheme;
  const stored = readStoredTheme();
  return stored && hasThemeFn(stored) ? stored : defaultTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeState = {
  currentTheme: string;
  systemTheme: "light" | "dark" | "auto";
  syncWithSystem: boolean;
  lastChanged: number | undefined;
};

type ThemeAction =
  | { type: "set-theme"; theme: string; timestamp: number }
  | { type: "set-system-theme"; mode: "light" | "dark" | "auto" }
  | { type: "set-sync-with-system"; value: boolean };

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case "set-theme":
      return { ...state, currentTheme: action.theme, lastChanged: action.timestamp };
    case "set-system-theme":
      return { ...state, systemTheme: action.mode, syncWithSystem: action.mode === "auto" };
    case "set-sync-with-system":
      return { ...state, syncWithSystem: action.value };
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  persist?: boolean;
  syncWithSystem?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = DEFAULT_THEME_NAME,
  persist = true,
  syncWithSystem: defaultSyncWithSystem = true,
}) => {
  const [themeState, dispatchTheme] = useReducer(
    themeReducer,
    { defaultTheme, persist, defaultSyncWithSystem },
    ({ defaultTheme: dt, persist: p, defaultSyncWithSystem: sync }) => ({
      currentTheme: resolveInitialTheme(dt, p),
      systemTheme: "auto" as const,
      syncWithSystem: sync,
      lastChanged: undefined,
    }),
  );
  const { currentTheme, systemTheme, syncWithSystem, lastChanged } = themeState;
  const transitionInFlightRef = useRef(false);

  const currentThemeMeta = findTheme(currentTheme);

  const isDarkMode = currentThemeMeta?.category === "dark";
  const isLightMode = currentThemeMeta?.category === "light";

  const applyTheme = useCallback((themeName: string) => {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") === themeName) return;

    const swap = () => {
      root.setAttribute("data-theme", themeName);
      document.body.removeAttribute("data-theme");
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => ViewTransitionLike;
    };

    // One root-level cross-fade (Chromium). Chromium aborts a transition started while the
    // window is hidden or while another one runs, so those cases swap instantly instead.
    if (
      !reduceMotion &&
      document.visibilityState === "visible" &&
      !transitionInFlightRef.current &&
      typeof doc.startViewTransition === "function"
    ) {
      transitionInFlightRef.current = true;
      const transition = doc.startViewTransition(swap);
      const ignoreSkipped = () => {};
      transition.ready.catch(ignoreSkipped);
      transition.updateCallbackDone.catch(ignoreSkipped);
      void transition.finished.catch(ignoreSkipped).finally(() => {
        transitionInFlightRef.current = false;
      });
      return;
    }

    root.classList.add("disable-transitions");
    swap();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("disable-transitions");
      });
    });
  }, []);

  const setTheme = useCallback(
    (themeName: string) => {
      const theme = findTheme(themeName);
      if (!theme) {
        return;
      }

      dispatchTheme({ type: "set-theme", theme: themeName, timestamp: Date.now() });
      applyTheme(themeName);

      if (persist) {
        try {
          localStorage.setItem("waypaper-theme", themeName);
        } catch (error) {
          logger.warn("Failed to persist theme selection:", error);
        }
      }
    },
    [applyTheme, persist],
  );

  const toggleTheme = useCallback(() => {
    const current = findTheme(currentTheme);
    if (!current) return;

    const oppositeCategory = current.category === "dark" ? "light" : "dark";
    const oppositeTheme = themes.find((t) => t.category === oppositeCategory);

    if (oppositeTheme) {
      setTheme(oppositeTheme.name);
    }
  }, [currentTheme, setTheme]);

  const setSystemThemePreference = useCallback(
    (mode: "light" | "dark" | "auto") => {
      dispatchTheme({ type: "set-system-theme", mode });

      if (persist) {
        try {
          localStorage.setItem("waypaper-system-theme", mode);
        } catch (error) {
          logger.warn("Failed to persist system theme preference:", error);
        }
      }

      if (mode === "auto") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const themeName = prefersDark ? "dark" : "light";
        setTheme(themeName);
      } else {
        setTheme(mode);
      }
    },
    [persist, setTheme],
  );

  const setSyncWithSystem = useCallback((value: boolean) => {
    dispatchTheme({ type: "set-sync-with-system", value });
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
  }, [defaultTheme, setTheme]);

  const getThemeByName = useCallback((name: string): ThemeMeta | undefined => {
    return findTheme(name);
  }, []);

  const hasTheme = useCallback((name: string): boolean => {
    return hasThemeFn(name);
  }, []);

  const getAvailableThemes = useCallback((): readonly ThemeMeta[] => {
    return themes;
  }, []);

  useEffect(() => {
    // main.tsx already set data-theme synchronously before React mounted.
    // Re-running applyTheme on mount triggers a redundant startViewTransition
    // that races StartupIntro's mount and causes a visible snap on the overlay.
    if (document.documentElement.getAttribute("data-theme") === currentTheme) {
      return;
    }
    applyTheme(currentTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSystemThemeChange = useEffectEvent((e: MediaQueryListEvent) => {
    const themeName = e.matches ? "dark" : "light";
    setTheme(themeName);
  });

  useEffect(() => {
    if (!syncWithSystem || systemTheme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => onSystemThemeChange(e);

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [syncWithSystem, systemTheme]);

  // Follow theme changes made elsewhere (settings in another view, the CLI, a config file edit).
  // The first observed value is skipped: on startup the persisted theme is already applied, and a
  // failed config load falls back to defaults that must not override it.
  const configTheme = useSettingsStore((s) => s.config?.app?.theme);
  const seenConfigThemeRef = useRef(false);
  const onConfigTheme = useEffectEvent((theme: string) => {
    if (theme === "system") {
      if (!syncWithSystem) setSystemThemePreference("auto");
    } else if (hasTheme(theme)) {
      setTheme(theme);
    }
  });
  useEffect(() => {
    if (!configTheme) return;
    if (!seenConfigThemeRef.current) {
      seenConfigThemeRef.current = true;
      return;
    }
    onConfigTheme(configTheme);
  }, [configTheme]);

  const contextValue: ThemeContextType = useMemo(
    () => ({
      currentTheme,
      systemTheme,
      themes,
      lastChanged,
      syncWithSystem,
      isDarkMode,
      isLightMode,
      currentThemeMeta,
      setTheme,
      toggleTheme,
      setSystemThemePreference,
      setSyncWithSystem,
      resetTheme,
      getTheme: getThemeByName,
      hasTheme,
      getAvailableThemes,
    }),
    [
      currentTheme,
      systemTheme,
      lastChanged,
      syncWithSystem,
      isDarkMode,
      isLightMode,
      currentThemeMeta,
      setTheme,
      toggleTheme,
      setSystemThemePreference,
      resetTheme,
      getThemeByName,
      hasTheme,
      getAvailableThemes,
    ],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = use(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
