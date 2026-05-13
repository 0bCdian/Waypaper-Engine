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
import { daemonClient } from "@/client";

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
  const isLoading = false;

  const currentThemeRef = useRef(currentTheme);
  currentThemeRef.current = currentTheme;

  const currentThemeMeta = findTheme(currentTheme);

  const isDarkMode = currentThemeMeta?.category === "dark";
  const isLightMode = currentThemeMeta?.category === "light";

  const applyTheme = useCallback((themeName: string) => {
    const swap = () => {
      document.documentElement.setAttribute("data-theme", themeName);
      document.body.removeAttribute("data-theme");
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };

    // One root-level cross-fade (Electron/Chromium). Avoids animating every descendant.
    if (!reduceMotion && typeof doc.startViewTransition === "function") {
      doc.startViewTransition(swap);
      return;
    }

    document.documentElement.classList.add("disable-transitions");
    swap();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("disable-transitions");
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

  useEffect(() => {
    const dispose = daemonClient.on("config_changed", (data: unknown) => {
      const event = data as { sections?: string[]; source?: string };
      const secs = event.sections;
      if (Array.isArray(secs) && secs.length > 0 && !secs.includes("app")) {
        return;
      }
      void daemonClient.getConfig().then((config) => {
        const newTheme = config?.app?.theme;
        if (!newTheme) return;
        if (newTheme === "system") {
          if (!syncWithSystem) {
            setSystemThemePreference("auto");
          }
        } else if (newTheme !== currentThemeRef.current && hasTheme(newTheme)) {
          setTheme(newTheme);
        }
      });
    });
    return dispose;
  }, [syncWithSystem, hasTheme, setTheme, setSystemThemePreference]);

  const contextValue: ThemeContextType = useMemo(
    () => ({
      currentTheme,
      systemTheme,
      themes,
      isLoading,
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
      isLoading,
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

export default ThemeProvider;
