import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ThemeContextType } from "./types";
import type { ThemeConfig } from "../themes/types";
import { themes } from "../themes/themes";
import { logger } from "../utils/logger";

// Default theme name
const DEFAULT_THEME_NAME = "kolision-raw";

const getTheme = (name: string) => themes[name];

function hasThemeFn(name: string): boolean {
  return name in themes && (themes[name].available ?? true);
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
  syncWithSystem: initialSyncWithSystem = true,
}) => {
  const [currentTheme, setCurrentThemeState] = useState<string>(() =>
    resolveInitialTheme(defaultTheme, persist),
  );
  const [systemTheme, setSystemTheme] = useState<"light" | "dark" | "auto">("auto");
  const [syncWithSystem, setSyncWithSystem] = useState<boolean>(initialSyncWithSystem);
  const [isLoading] = useState(false);
  const [lastChanged, setLastChanged] = useState<number | undefined>();

  /** Used by SSE config listener — must not restart that subscription on each theme flip. */
  const currentThemeRef = useRef(currentTheme);
  currentThemeRef.current = currentTheme;

  const currentThemeConfig = getTheme(currentTheme);

  const isDarkMode = currentThemeConfig?.category === "dark";
  const isLightMode = currentThemeConfig?.category === "light";

  const applyTheme = useCallback((themeName: string) => {
    // Disable all CSS transitions to prevent color flashing during theme switch
    document.documentElement.classList.add("disable-transitions");

    document.documentElement.setAttribute("data-theme", themeName);
    // Remove any conflicting data-theme from body
    document.body.removeAttribute("data-theme");

    // Re-enable transitions after the browser has painted with the new theme
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("disable-transitions");
      });
    });
  }, []);

  const setTheme = useCallback(
    (themeName: string) => {
      const theme = getTheme(themeName);
      if (!theme) {
        return;
      }

      const timestamp = Date.now();

      setCurrentThemeState(themeName);
      setLastChanged(timestamp);

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
    const current = getTheme(currentTheme);
    if (!current) return;

    const oppositeCategory = current.category === "dark" ? "light" : "dark";
    const oppositeTheme = Object.values(themes).find(
      (theme) => theme.category === oppositeCategory && theme.available,
    );

    if (oppositeTheme) {
      setTheme(oppositeTheme.name);
    }
  }, [currentTheme, setTheme]);

  const setSystemThemePreference = useCallback(
    (mode: "light" | "dark" | "auto") => {
      setSystemTheme(mode);
      setSyncWithSystem(mode === "auto");

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
  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
  }, [defaultTheme, setTheme]);

  const getThemeByName = useCallback((name: string): ThemeConfig | undefined => {
    return getTheme(name);
  }, []);

  const hasTheme = useCallback((name: string): boolean => {
    return name in themes && (themes[name].available ?? true);
  }, []);

  const availableThemesList = useMemo(
    () =>
      Object.values(themes)
        .filter((theme) => theme.available ?? true)
        .map((theme) => ({
          name: theme.name,
          displayName: theme.displayName,
          description: theme.description,
          category: theme.category,
          previewImage: theme.previewImage,
          available: theme.available ?? true,
        })),
    [],
  );

  const getAvailableThemes = useCallback(() => availableThemesList, [availableThemesList]);

  // Apply the resolved theme on mount only; setTheme handles subsequent changes synchronously.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  useEffect(() => {
    if (!syncWithSystem || systemTheme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const themeName = e.matches ? "dark" : "light";
      setTheme(themeName);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [syncWithSystem, systemTheme]);

  useEffect(() => {
    if (!window.API_RENDERER?.goDaemon) return;
    const dispose = window.API_RENDERER.goDaemon.on("config_changed", (data: unknown) => {
      const event = data as { sections?: string[]; source?: string };
      const secs = event.sections;
      if (Array.isArray(secs) && secs.length > 0 && !secs.includes("app")) {
        return;
      }
      void window.API_RENDERER.goDaemon.getConfig().then((config) => {
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

  // Context value
  const contextValue: ThemeContextType = useMemo(
    () => ({
      // State
      currentTheme,
      systemTheme,
      themes,
      isLoading,
      lastChanged,
      syncWithSystem,

      // Computed values
      isDarkMode,
      isLightMode,
      currentThemeConfig,

      // Actions
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
      currentThemeConfig,
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
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};

export default ThemeProvider;
