import type { ThemeMeta } from "../themes/types";

export interface ThemeContextType {
  currentTheme: string;
  themes: readonly ThemeMeta[];
  setTheme: (themeName: string) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  isLightMode: boolean;
  syncWithSystem: boolean;
  setSyncWithSystem: (sync: boolean) => void;
  setSystemThemePreference: (mode: "light" | "dark" | "auto") => void;
  getAvailableThemes: () => readonly ThemeMeta[];
  currentThemeMeta: ThemeMeta | undefined;
  systemTheme: "light" | "dark" | "auto";
  isLoading: boolean;
  lastChanged?: number;
  resetTheme: () => void;
  getTheme: (name: string) => ThemeMeta | undefined;
  hasTheme: (name: string) => boolean;
}
