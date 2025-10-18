/**
 * Theme Selector Component for Waypaper Engine
 *
 * This component provides a dropdown interface for selecting themes,
 * using the theme-change library approach similar to Upscayl.
 */

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Theme Selector Props
 */
interface ThemeSelectorProps {
	/** Additional CSS classes */
	className?: string;
	/** Whether to show theme previews */
	showPreviews?: boolean;
	/** Whether to show theme descriptions */
	showDescriptions?: boolean;
	/** Custom trigger element */
	trigger?: React.ReactNode;
	/** Position of the dropdown */
	position?: "left" | "right" | "center";
}

/**
 * Theme Selector Component
 */
export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
	className = "",
	showPreviews = true,
	showDescriptions = false,
	trigger,
	position = "right",
}) => {
	const { currentTheme, setTheme, getAvailableThemes } = useTheme();
	const [searchTerm, setSearchTerm] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Initialize theme system
	useEffect(() => {
		// Ensure the initial theme is applied
		document.documentElement.setAttribute("data-theme", currentTheme);
	}, [currentTheme]);

	// Get available themes
	const availableThemes = getAvailableThemes();
	console.log("ThemeSelector: Available themes:", availableThemes);

	// Filter themes based on search term
	const filteredThemes = availableThemes.filter(
		(theme) =>
			theme.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			theme.description.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	// Group themes by category
	const themesByCategory = filteredThemes.reduce(
		(acc, theme) => {
			if (!acc[theme.category]) {
				acc[theme.category] = [];
			}
			acc[theme.category].push(theme);
			return acc;
		},
		{} as Record<string, typeof availableThemes>,
	);

	// Handle theme selection
	const handleThemeSelect = (themeName: string) => {
		console.log("ThemeSelector: Selecting theme:", themeName);
		setTheme(themeName);
		setSearchTerm("");

		// Also update the data-theme attribute directly for immediate effect
		document.documentElement.setAttribute("data-theme", themeName);
	};

	// Handle keyboard navigation
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Escape") {
			setSearchTerm("");
		}
	};

	// Get position classes
	const getPositionClasses = () => {
		switch (position) {
			case "left":
				return "dropdown-left";
			case "center":
				return "dropdown-center";
			case "right":
			default:
				return "dropdown-end";
		}
	};

	return (
		<div className={`dropdown ${getPositionClasses()} ${className}`}>
			{/* Trigger Button */}
			<div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2">
				{trigger || (
					<>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
							/>
						</svg>
						<span className="hidden sm:inline">Theme</span>
						<svg
							className="w-3 h-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</>
				)}
			</div>

			{/* Dropdown Content */}
			<div
				ref={dropdownRef}
				className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-80 max-h-96 overflow-y-auto theme-scrollbar"
				onKeyDown={handleKeyDown}
			>
				{/* Search Input */}
				<div className="form-control mb-2">
					<input
						type="text"
						placeholder="Search themes..."
						className="input input-sm"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						autoFocus
					/>
				</div>

				{/* Theme Categories */}
				{Object.entries(themesByCategory).map(([category, themes]) => (
					<div key={category} className="mb-4">
						{/* Category Header */}
						<div className="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2 px-2">
							{category}
						</div>

						{/* Theme List */}
						<ul className="space-y-1">
							{themes.map((theme) => {
								const isActive = theme.name === currentTheme;

								return (
									<li key={theme.name}>
										<button
											className={`btn btn-sm btn-ghost w-full justify-start gap-3 ${
												isActive ? "btn-active" : ""
											}`}
											onClick={() => handleThemeSelect(theme.name)}
											disabled={!theme.available}
										>
											{/* Theme Preview */}
											{showPreviews && (
												<div className="flex gap-1">
													<div className="w-3 h-3 rounded-full bg-primary" />
													<div className="w-3 h-3 rounded-full bg-secondary" />
													<div className="w-3 h-3 rounded-full bg-accent" />
												</div>
											)}

											{/* Theme Info */}
											<div className="flex flex-col items-start flex-1">
												<span className="font-medium">{theme.displayName}</span>
												{showDescriptions && (
													<span className="text-xs text-base-content/60">
														{theme.description}
													</span>
												)}
											</div>

											{/* Active Indicator */}
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
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				))}

				{/* No Results */}
				{filteredThemes.length === 0 && (
					<div className="text-center py-4 text-base-content/60">
						<p className="text-sm">No themes found</p>
						<p className="text-xs">Try a different search term</p>
					</div>
				)}

				{/* Footer */}
				<div className="divider my-2"></div>
				<div className="text-xs text-base-content/60 text-center">
					{availableThemes.length} theme
					{availableThemes.length !== 1 ? "s" : ""} available
				</div>
			</div>
		</div>
	);
};

/**
 * Compact Theme Selector for mobile/small screens
 */
export const CompactThemeSelector: React.FC<
	Omit<ThemeSelectorProps, "showPreviews" | "showDescriptions">
> = (props) => {
	return (
		<ThemeSelector {...props} showPreviews={false} showDescriptions={false} />
	);
};

/**
 * Full Theme Selector with all features
 */
export const FullThemeSelector: React.FC<ThemeSelectorProps> = (props) => {
	return (
		<ThemeSelector {...props} showPreviews={true} showDescriptions={true} />
	);
};

/**
 * Simple Select-based Theme Selector (Custom CSS themes)
 */
export const SimpleThemeSelector: React.FC<{ className?: string }> = ({
	className = "",
}) => {
	const { currentTheme, getAvailableThemes, setTheme } = useTheme();
	const availableThemes = getAvailableThemes();

	const handleThemeChange = (themeName: string) => {
		setTheme(themeName);
	};

	return (
		<select
			className={`select select-primary select-sm ${className}`}
			value={currentTheme}
			onChange={(e) => handleThemeChange(e.target.value)}
		>
			{availableThemes.map((theme) => (
				<option value={theme.name} key={theme.name}>
					{theme.displayName}
				</option>
			))}
		</select>
	);
};

export default ThemeSelector;
