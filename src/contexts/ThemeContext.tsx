/**
 * Theme Context System for Waypaper Engine
 *
 * This file provides React context for theme management, including
 * theme switching, persistence, and synchronization with system preferences.
 * Uses DaisyUI's data-theme attribute system for seamless theme switching.
 */

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	ReactNode,
} from "react";
import { ThemeContextType } from "./types";
import { ThemeConfig } from "../themes/types";
import { themes } from "../themes/themes";

// Default theme name
const DEFAULT_THEME_NAME = "dark";

/**
 * Get theme by name from the themes registry
 * @param name - The theme name to retrieve
 * @returns Theme configuration or undefined if not found
 */
const getTheme = (name: string) => themes[name];

/**
 * Theme Context for providing theme state and actions to child components
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Props
 */
interface ThemeProviderProps {
	children: ReactNode;
	defaultTheme?: string;
	persist?: boolean;
	syncWithSystem?: boolean;
}

/**
 * Theme Provider Component
 *
 * Provides theme context to all child components and manages theme state,
 * persistence, and system synchronization using DaisyUI's data-theme system.
 *
 * @param children - React child components
 * @param defaultTheme - Default theme to use if none is saved (default: 'dark')
 * @param persist - Whether to persist theme selection to localStorage (default: true)
 * @param syncWithSystem - Whether to sync with system theme preference (default: true)
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
	children,
	defaultTheme = DEFAULT_THEME_NAME,
	persist = true,
	syncWithSystem: initialSyncWithSystem = true,
}) => {
	const [currentTheme, setCurrentThemeState] = useState<string>(defaultTheme);
	const [systemTheme, setSystemTheme] = useState<"light" | "dark" | "auto">(
		"auto",
	);
	const [syncWithSystem, setSyncWithSystem] = useState<boolean>(
		initialSyncWithSystem,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [lastChanged, setLastChanged] = useState<number | undefined>();

	const currentThemeConfig = getTheme(currentTheme);

	const isDarkMode = currentThemeConfig?.category === "dark";
	const isLightMode = currentThemeConfig?.category === "light";

	/**
	 * Apply theme to document using DaisyUI's data-theme attribute
	 *
	 * Sets the data-theme attribute on document.documentElement only.
	 * DaisyUI themes should only be applied to the root element to avoid conflicts.
	 *
	 * @param themeName - The name of the theme to apply
	 */
	const applyTheme = useCallback((themeName: string) => {
		document.documentElement.setAttribute("data-theme", themeName);
		// Remove any conflicting data-theme from body
		document.body.removeAttribute("data-theme");
	}, []);

	/**
	 * Set theme with persistence and validation
	 *
	 * Validates the theme exists, updates the current theme state, applies the theme
	 * to the document, and optionally persists the selection to localStorage.
	 *
	 * @param themeName - The name of the theme to set
	 */
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
					console.warn("Failed to persist theme selection:", error);
				}
			}
		},
		[currentTheme, applyTheme, persist],
	);

	/**
	 * Toggle between light and dark themes
	 *
	 * Automatically switches to the opposite theme category (light ↔ dark).
	 * Finds the first available theme in the opposite category and applies it.
	 */
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

	/**
	 * Set system theme preference
	 *
	 * Configures how the theme system responds to system theme changes.
	 * When set to 'auto', the theme will automatically switch based on the
	 * system's dark/light mode preference.
	 *
	 * @param mode - System theme mode: 'light', 'dark', or 'auto'
	 */
	const setSystemThemePreference = useCallback(
		(mode: "light" | "dark" | "auto") => {
			setSystemTheme(mode);
			setSyncWithSystem(mode === "auto");

			if (persist) {
				try {
					localStorage.setItem("waypaper-system-theme", mode);
				} catch (error) {
					console.warn("Failed to persist system theme preference:", error);
				}
			}

			if (mode === "auto") {
				const prefersDark = window.matchMedia(
					"(prefers-color-scheme: dark)",
				).matches;
				const themeName = prefersDark ? "dark" : "light";
				setTheme(themeName);
			} else {
				setTheme(mode);
			}
		},
		[setTheme, persist],
	);
	/**
	 * Reset to default theme
	 *
	 * Resets the current theme to the default theme specified in the provider props.
	 */
	const resetTheme = useCallback(() => {
		setTheme(defaultTheme);
	}, [setTheme, defaultTheme]);

	/**
	 * Get theme by name
	 *
	 * Retrieves a theme configuration by its name from the themes registry.
	 *
	 * @param name - The name of the theme to retrieve
	 * @returns Theme configuration or undefined if not found
	 */
	const getThemeByName = useCallback(
		(name: string): ThemeConfig | undefined => {
			return getTheme(name);
		},
		[],
	);

	/**
	 * Check if theme exists
	 *
	 * Verifies whether a theme with the given name exists and is available.
	 *
	 * @param name - The name of the theme to check
	 * @returns True if the theme exists and is available, false otherwise
	 */
	const hasTheme = useCallback((name: string): boolean => {
		return name in themes && (themes[name].available ?? true);
	}, []);

	/**
	 * Get all available themes
	 *
	 * Returns an array of all themes that are marked as available,
	 * formatted for display purposes with metadata.
	 *
	 * @returns Array of theme metadata objects
	 */
	const getAvailableThemes = useCallback(() => {
		return Object.values(themes)
			.filter((theme) => theme.available ?? true)
			.map((theme) => ({
				name: theme.name,
				displayName: theme.displayName,
				description: theme.description,
				category: theme.category,
				previewImage: theme.previewImage,
				available: theme.available ?? true,
			}));
	}, []);

	/**
	 * Initialize theme on mount
	 *
	 * Loads saved theme from localStorage or uses default theme,
	 * then applies it to the document.
	 */
	useEffect(() => {
		const initializeTheme = () => {
			try {
				// Get saved theme or use default
				let savedTheme = defaultTheme;
				if (persist) {
					try {
						const stored = localStorage.getItem("waypaper-theme");
						if (stored && hasTheme(stored)) {
							savedTheme = stored;
						}
					} catch (error) {
						console.warn("Failed to load saved theme:", error);
					}
				}

				setCurrentThemeState(savedTheme);
				applyTheme(savedTheme);

				setIsLoading(false);
			} catch (error) {
				console.error("Failed to initialize theme:", error);
				applyTheme(defaultTheme);
				setIsLoading(false);
			}
		};

		initializeTheme();
	}, [applyTheme, defaultTheme, persist, hasTheme]);

	/**
	 * Listen for system theme changes
	 *
	 * Automatically switches theme when system dark/light mode preference changes,
	 * but only when syncWithSystem is enabled and systemTheme is set to 'auto'.
	 */
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
	}, [syncWithSystem, systemTheme, setTheme]);

	// Context value
	const contextValue: ThemeContextType = {
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
	};

	return (
		<ThemeContext.Provider value={contextValue}>
			{children}
		</ThemeContext.Provider>
	);
};

/**
 * Hook to use theme context
 *
 * Provides access to the theme context value including current theme state,
 * theme switching functions, and theme metadata.
 *
 * @returns Theme context value with all theme-related state and actions
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
	const context = useContext(ThemeContext);

	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}

	return context;
};

/**
 * Hook for theme-specific utilities
 *
 * Provides utility functions for working with the current theme,
 * including color access, CSS class generation, and theme variables.
 *
 * @returns Object containing theme utility functions and current theme info
 */
export const useThemeUtils = () => {
	const { currentTheme, currentThemeConfig, isDarkMode, isLightMode } =
		useTheme();

	/**
	 * Get color value from current theme
	 *
	 * @param colorName - The name of the color to retrieve
	 * @returns Color value as string, or empty string if not found
	 */
	const getColor = useCallback(
		(colorName: keyof ThemeConfig["colors"]) => {
			return (currentThemeConfig?.colors as any)?.[colorName] || "";
		},
		[currentThemeConfig],
	);

	/**
	 * Check if current theme has a specific color
	 *
	 * @param colorName - The name of the color to check
	 * @returns True if the color exists in the current theme
	 */
	const hasColor = useCallback(
		(colorName: keyof ThemeConfig["colors"]) => {
			return Boolean((currentThemeConfig?.colors as any)?.[colorName]);
		},
		[currentThemeConfig],
	);

	/**
	 * Get theme-specific CSS class
	 *
	 * @param baseClass - Base CSS class name
	 * @returns CSS class with theme prefix
	 */
	const getThemeClass = useCallback(
		(baseClass: string) => {
			return `${baseClass} theme-${currentTheme}`;
		},
		[currentTheme],
	);

	/**
	 * Get theme-specific CSS variables
	 *
	 * @returns Object containing CSS custom properties for the current theme
	 */
	const getThemeVariables = useCallback(() => {
		if (!currentThemeConfig) return {};

		const variables: Record<string, string> = {};
		Object.entries(currentThemeConfig.colors).forEach(([key, value]) => {
			if (typeof value === "string") {
				variables[`--color-${key}`] = value;
			}
		});

		return variables;
	}, [currentThemeConfig]);

	return {
		getColor,
		hasColor,
		getThemeClass,
		getThemeVariables,
		isDarkMode,
		isLightMode,
		currentTheme,
		currentThemeConfig,
	};
};

export default ThemeProvider;
