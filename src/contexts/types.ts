/**
 * Theme Context Types for Waypaper Engine
 */

import type { ThemeConfig } from "../themes/types";

/**
 * Theme context type interface
 */
export interface ThemeContextType {
	currentTheme: string;
	themes: Record<string, ThemeConfig>;
	setTheme: (themeName: string) => void;
	toggleTheme: () => void;
	isDarkMode: boolean;
	isLightMode: boolean;
	syncWithSystem: boolean;
	setSyncWithSystem: (sync: boolean) => void;
	setSystemThemePreference: (mode: "light" | "dark" | "auto") => void;
	getAvailableThemes: () => Array<{
		name: string;
		displayName: string;
		description: string;
		category: string;
		previewImage?: string;
		available: boolean;
	}>;
	currentThemeConfig: ThemeConfig;
	systemTheme: "light" | "dark" | "auto";
	isLoading: boolean;
	lastChanged?: number;
	resetTheme: () => void;
	getTheme: (name: string) => ThemeConfig | undefined;
	hasTheme: (name: string) => boolean;
}
