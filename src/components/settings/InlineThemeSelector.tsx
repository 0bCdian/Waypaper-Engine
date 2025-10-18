/**
 * Inline Theme Selector Component for Settings Page
 *
 * A non-floating theme selector designed specifically for the settings page.
 * Provides a grid layout with theme previews and descriptions.
 */

import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";

/**
 * Inline Theme Selector Props
 */
interface InlineThemeSelectorProps {
	/** Additional CSS classes */
	className?: string;
	/** Whether to show theme descriptions */
	showDescriptions?: boolean;
	/** Callback when theme changes */
	onThemeChange?: (themeName: string) => void;
	/** Filter themes by category (light/dark) */
	categoryFilter?: "light" | "dark";
}

/**
 * Theme preview colors for visual representation
 */
const getThemePreviewColors = (themeName: string) => {
	// Define preview colors for different themes
	const themeColors: Record<
		string,
		{ primary: string; secondary: string; accent: string; background: string }
	> = {
		light: {
			primary: "#3b82f6",
			secondary: "#64748b",
			accent: "#f59e0b",
			background: "#ffffff",
		},
		dark: {
			primary: "#60a5fa",
			secondary: "#94a3b8",
			accent: "#fbbf24",
			background: "#1e293b",
		},
		system: {
			primary: "#8b5cf6",
			secondary: "#a78bfa",
			accent: "#f59e0b",
			background: "#f8fafc",
		},
		cupcake: {
			primary: "#65c3c8",
			secondary: "#f0a6ca",
			accent: "#f9d71c",
			background: "#faf7f5",
		},
		bumblebee: {
			primary: "#f9d71c",
			secondary: "#f0a6ca",
			accent: "#65c3c8",
			background: "#faf7f5",
		},
		emerald: {
			primary: "#10b981",
			secondary: "#6ee7b7",
			accent: "#f59e0b",
			background: "#f0fdf4",
		},
		corporate: {
			primary: "#3b82f6",
			secondary: "#64748b",
			accent: "#f59e0b",
			background: "#ffffff",
		},
		synthwave: {
			primary: "#ff006e",
			secondary: "#8338ec",
			accent: "#ffbe0b",
			background: "#0a0a0a",
		},
		retro: {
			primary: "#ef4444",
			secondary: "#f97316",
			accent: "#eab308",
			background: "#fef3c7",
		},
		cyberpunk: {
			primary: "#00ff88",
			secondary: "#ff0080",
			accent: "#ffff00",
			background: "#0a0a0a",
		},
		valentine: {
			primary: "#e11d48",
			secondary: "#f43f5e",
			accent: "#fbbf24",
			background: "#fef7f7",
		},
		halloween: {
			primary: "#f97316",
			secondary: "#ef4444",
			accent: "#eab308",
			background: "#1a1a1a",
		},
		garden: {
			primary: "#22c55e",
			secondary: "#16a34a",
			accent: "#f59e0b",
			background: "#f0fdf4",
		},
		forest: {
			primary: "#059669",
			secondary: "#047857",
			accent: "#d97706",
			background: "#f0fdf4",
		},
		aqua: {
			primary: "#06b6d4",
			secondary: "#0891b2",
			accent: "#f59e0b",
			background: "#f0f9ff",
		},
		lofi: {
			primary: "#6b7280",
			secondary: "#9ca3af",
			accent: "#f59e0b",
			background: "#f9fafb",
		},
		pastel: {
			primary: "#a78bfa",
			secondary: "#c4b5fd",
			accent: "#fbbf24",
			background: "#fef7ff",
		},
		fantasy: {
			primary: "#ec4899",
			secondary: "#f472b6",
			accent: "#f59e0b",
			background: "#fdf2f8",
		},
		wireframe: {
			primary: "#000000",
			secondary: "#6b7280",
			accent: "#f59e0b",
			background: "#ffffff",
		},
		black: {
			primary: "#ffffff",
			secondary: "#6b7280",
			accent: "#f59e0b",
			background: "#000000",
		},
		luxury: {
			primary: "#d4af37",
			secondary: "#b8860b",
			accent: "#f59e0b",
			background: "#1a1a1a",
		},
		dracula: {
			primary: "#ff79c6",
			secondary: "#bd93f9",
			accent: "#f1fa8c",
			background: "#282a36",
		},
		cmyk: {
			primary: "#00ffff",
			secondary: "#ff00ff",
			accent: "#ffff00",
			background: "#000000",
		},
		autumn: {
			primary: "#ea580c",
			secondary: "#dc2626",
			accent: "#eab308",
			background: "#fef3c7",
		},
		business: {
			primary: "#1d4ed8",
			secondary: "#374151",
			accent: "#f59e0b",
			background: "#ffffff",
		},
		acid: {
			primary: "#00ff00",
			secondary: "#ff00ff",
			accent: "#ffff00",
			background: "#000000",
		},
		lemonade: {
			primary: "#eab308",
			secondary: "#f59e0b",
			accent: "#ef4444",
			background: "#fefce8",
		},
		night: {
			primary: "#3b82f6",
			secondary: "#64748b",
			accent: "#f59e0b",
			background: "#0f172a",
		},
		coffee: {
			primary: "#92400e",
			secondary: "#a16207",
			accent: "#f59e0b",
			background: "#fef3c7",
		},
		winter: {
			primary: "#0ea5e9",
			secondary: "#64748b",
			accent: "#f59e0b",
			background: "#f8fafc",
		},
	};

	return themeColors[themeName] || themeColors["dark"];
};

/**
 * Inline Theme Selector Component
 */
export const InlineThemeSelector: React.FC<InlineThemeSelectorProps> = ({
	className = "",
	showDescriptions = true,
	onThemeChange,
	categoryFilter,
}) => {
	const { currentTheme, setTheme, getAvailableThemes } = useTheme();
	const availableThemes = getAvailableThemes();

	// Group themes by category
	const themesByCategory = availableThemes.reduce(
		(acc, theme) => {
			// Filter by category if specified
			if (categoryFilter) {
				// Include themes that match the filter OR are 'mixed' (show in both tabs)
				if (theme.category !== categoryFilter && theme.category !== "mixed") {
					return acc;
				}
			}

			if (!acc[theme.category]) {
				acc[theme.category] = [];
			}
			acc[theme.category].push(theme);
			return acc;
		},
		{} as Record<string, typeof availableThemes>,
	);

	const handleThemeSelect = (themeName: string) => {
		setTheme(themeName);
		onThemeChange?.(themeName);
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Current Theme Display */}
			<div className="bg-base-200 rounded-lg p-4">
				<div className="flex items-center gap-4">
					<div className="text-sm font-medium text-base-content">
						Current Theme
					</div>
					<div className="flex items-center gap-2">
						<div className="flex gap-1">
							{(() => {
								const colors = getThemePreviewColors(currentTheme);
								return (
									<>
										<div
											className="w-4 h-4 rounded-full border border-base-300"
											style={{ backgroundColor: colors.primary }}
										/>
										<div
											className="w-4 h-4 rounded-full border border-base-300"
											style={{ backgroundColor: colors.secondary }}
										/>
										<div
											className="w-4 h-4 rounded-full border border-base-300"
											style={{ backgroundColor: colors.accent }}
										/>
									</>
								);
							})()}
						</div>
						<span className="text-sm font-medium capitalize">
							{currentTheme}
						</span>
					</div>
				</div>
			</div>

			{/* Theme Grid */}
			<div className="space-y-4">
				{Object.entries(themesByCategory).map(([category, themes]) => (
					<div key={category} className="space-y-3">
						{/* Category Header */}
						<div className="text-sm font-semibold text-base-content/80 uppercase tracking-wide">
							{category}
						</div>

						{/* Theme Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{themes.map((theme) => {
								const isActive = theme.name === currentTheme;
								const colors = getThemePreviewColors(theme.name);

								return (
									<button
										key={theme.name}
										className={cn(
											"relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md",
											"flex flex-col items-center gap-3 text-left",
											isActive
												? "border-primary bg-primary/10 shadow-md"
												: "border-base-300 bg-base-100 hover:border-base-400",
										)}
										onClick={() => handleThemeSelect(theme.name)}
										disabled={!theme.available}
									>
										{/* Theme Preview */}
										<div className="w-full h-16 rounded border border-base-300 overflow-hidden">
											<div
												className="w-full h-full relative"
												style={{ backgroundColor: colors.background }}
											>
												{/* Preview elements */}
												<div
													className="absolute top-2 left-2 w-8 h-4 rounded"
													style={{ backgroundColor: colors.primary }}
												/>
												<div
													className="absolute top-2 right-2 w-6 h-4 rounded"
													style={{ backgroundColor: colors.secondary }}
												/>
												<div
													className="absolute bottom-2 left-2 w-4 h-4 rounded"
													style={{ backgroundColor: colors.accent }}
												/>
												<div
													className="absolute bottom-2 right-2 w-6 h-2 rounded"
													style={{ backgroundColor: colors.primary }}
												/>
											</div>
										</div>

										{/* Theme Info */}
										<div className="w-full space-y-1">
											<div className="flex items-center justify-between">
												<span className="font-medium text-sm capitalize">
													{theme.displayName}
												</span>
												{isActive && (
													<svg
														className="w-4 h-4 text-primary"
														fill="currentColor"
														viewBox="0 0 20 20"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path
															fillRule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															clipRule="evenodd"
														/>
													</svg>
												)}
											</div>

											{showDescriptions && (
												<p className="text-xs text-base-content/60 leading-relaxed">
													{theme.description}
												</p>
											)}
										</div>

										{/* Color Palette */}
										<div className="flex gap-1">
											<div
												className="w-3 h-3 rounded-full border border-base-300"
												style={{ backgroundColor: colors.primary }}
												title="Primary"
											/>
											<div
												className="w-3 h-3 rounded-full border border-base-300"
												style={{ backgroundColor: colors.secondary }}
												title="Secondary"
											/>
											<div
												className="w-3 h-3 rounded-full border border-base-300"
												style={{ backgroundColor: colors.accent }}
												title="Accent"
											/>
										</div>

										{/* Unavailable Overlay */}
										{!theme.available && (
											<div className="absolute inset-0 bg-base-100/80 rounded-lg flex items-center justify-center">
												<span className="text-xs text-base-content/60">
													Unavailable
												</span>
											</div>
										)}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{/* Theme Count */}
			<div className="text-xs text-base-content/60 text-center pt-2 border-t border-base-300">
				{Object.values(themesByCategory).flat().length} theme
				{Object.values(themesByCategory).flat().length !== 1 ? "s" : ""}{" "}
				available
				{categoryFilter && ` (${categoryFilter} + mixed)`}
			</div>
		</div>
	);
};

export default InlineThemeSelector;
