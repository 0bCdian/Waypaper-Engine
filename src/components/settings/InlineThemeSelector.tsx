/**
 * Inline Theme Selector Component for Settings Page
 *
 * Uses daisyUI theme-controller radio buttons for theme selection.
 * Each radio input with the theme-controller class lets daisyUI handle
 * the visual theme preview natively.
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
 * Inline Theme Selector Component
 */
export const InlineThemeSelector: React.FC<InlineThemeSelectorProps> =
	React.memo(({ className = "", onThemeChange, categoryFilter }) => {
		const { currentTheme, setTheme, getAvailableThemes } = useTheme();
		const availableThemes = getAvailableThemes();

		const filteredThemes = categoryFilter
			? availableThemes.filter(
					(theme) =>
						theme.category === categoryFilter ||
						theme.category === "mixed",
				)
			: availableThemes;

		const handleThemeSelect = (themeName: string) => {
			setTheme(themeName);
			onThemeChange?.(themeName);
		};

		return (
			<div className={cn("space-y-4", className)}>
				{/* Current theme indicator */}
				<div className="flex items-center gap-3 bg-base-200 rounded-lg px-4 py-3">
					<span className="text-sm font-medium text-base-content/70">
						Active:
					</span>
					<span className="badge badge-primary capitalize">
						{currentTheme}
					</span>
				</div>

				{/* Theme radio buttons grid */}
				<div className="flex flex-wrap gap-2">
					{filteredThemes.map((theme) => (
						<input
							key={theme.name}
							type="radio"
							name={`theme-selector${categoryFilter ? `-${categoryFilter}` : ""}`}
							className={cn(
								"btn btn-sm theme-controller",
								theme.name === currentTheme && "btn-primary",
							)}
							aria-label={theme.displayName}
							value={theme.name}
							checked={theme.name === currentTheme}
							onChange={() => handleThemeSelect(theme.name)}
							disabled={!theme.available}
						/>
					))}
				</div>

				{/* Theme count */}
				<div className="text-xs text-base-content/50 text-center pt-2 border-t border-base-300">
					{filteredThemes.length} theme
					{filteredThemes.length !== 1 ? "s" : ""} available
					{categoryFilter && ` (${categoryFilter} + mixed)`}
				</div>
			</div>
		);
	});

InlineThemeSelector.displayName = "InlineThemeSelector";

export default InlineThemeSelector;
