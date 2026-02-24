import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import type { ThemeContextType } from "./types";
import type { ThemeConfig } from "../themes/types";
import { themes } from "../themes/themes";
import { logger } from "../utils/logger";

// Default theme name
const DEFAULT_THEME_NAME = "dark";

const getTheme = (name: string) => themes[name];

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

	const applyTheme = (themeName: string) => {
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
	};

	const setTheme = (themeName: string) => {
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
	};

	const toggleTheme = () => {
		const current = getTheme(currentTheme);
		if (!current) return;

		const oppositeCategory = current.category === "dark" ? "light" : "dark";
		const oppositeTheme = Object.values(themes).find(
			(theme) => theme.category === oppositeCategory && theme.available,
		);

		if (oppositeTheme) {
			setTheme(oppositeTheme.name);
		}
	};

	const setSystemThemePreference = (mode: "light" | "dark" | "auto") => {
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
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			const themeName = prefersDark ? "dark" : "light";
			setTheme(themeName);
		} else {
			setTheme(mode);
		}
	};
	const resetTheme = () => {
		setTheme(defaultTheme);
	};

	const getThemeByName = (name: string): ThemeConfig | undefined => {
		return getTheme(name);
	};

	const hasTheme = (name: string): boolean => {
		return name in themes && (themes[name].available ?? true);
	};

	const getAvailableThemes = () => {
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
	};

	useEffect(() => {
		const initializeTheme = () => {
			try {
				// Get saved theme or use default
				let savedTheme = defaultTheme;
			if (persist) {
				let stored: string | null = null;
				try {
					stored = localStorage.getItem("waypaper-theme");
				} catch (error) {
					logger.warn("Failed to load saved theme:", error);
				}
				if (stored && hasTheme(stored)) {
					savedTheme = stored;
				}
			}

				setCurrentThemeState(savedTheme);
				applyTheme(savedTheme);

				setIsLoading(false);
			} catch (error) {
				logger.error("Failed to initialize theme:", error);
				applyTheme(defaultTheme);
				setIsLoading(false);
			}
		};

		initializeTheme();
	}, [defaultTheme, persist]);

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
		const dispose = window.API_RENDERER.goDaemon.on(
			"config_changed",
			(data: unknown) => {
				const event = data as { sections?: string[]; source?: string };
				if (!event.sections || event.sections.includes("app")) {
					void window.API_RENDERER.goDaemon.getConfig().then((config) => {
						const newTheme = config?.app?.theme;
						if (!newTheme) return;
						if (newTheme === "system") {
							if (!syncWithSystem) {
								setSystemThemePreference("auto");
							}
						} else if (newTheme !== currentTheme && hasTheme(newTheme)) {
							setTheme(newTheme);
						}
					});
				}
			},
		);
		return dispose;
	}, [currentTheme, syncWithSystem]);

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

export const useTheme = (): ThemeContextType => {
	const context = useContext(ThemeContext);

	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}

	return context;
};

export default ThemeProvider;
