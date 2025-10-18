/**
 * Theme Toggle Component for Waypaper Engine
 *
 * A simple toggle button for switching between light and dark themes.
 * Provides a quick way to toggle themes without opening the full selector.
 */

import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { IconButton } from "./Button";
import { cn } from "../../utils/cn";

/**
 * Theme Toggle props interface
 */
export interface ThemeToggleProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Whether to show text label */
	showLabel?: boolean;
	/** Whether to show tooltip */
	showTooltip?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Theme Toggle component
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
	showLabel = false,
	showTooltip = true,
	className,
	...props
}) => {
	const { toggleTheme, isDarkMode } = useTheme();

	// Get appropriate icon based on current theme
	const getIcon = () => {
		if (isDarkMode) {
			// Sun icon for dark mode (clicking will switch to light)
			return (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
			);
		} else {
			// Moon icon for light mode (clicking will switch to dark)
			return (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
					/>
				</svg>
			);
		}
	};

	// Get tooltip text
	const getTooltipText = () => {
		return isDarkMode ? "Switch to light mode" : "Switch to dark mode";
	};

	// Get label text
	const getLabelText = () => {
		return isDarkMode ? "Light" : "Dark";
	};

	const buttonClasses = cn("theme-transition", className);

	if (showLabel) {
		return (
			<button
				className={cn("btn btn-ghost btn-sm gap-2", buttonClasses)}
				onClick={toggleTheme}
				title={showTooltip ? getTooltipText() : undefined}
				{...props}
			>
				{getIcon()}
				<span className="hidden sm:inline">{getLabelText()}</span>
			</button>
		);
	}

	return (
		<IconButton
			icon={getIcon()}
			aria-label={getTooltipText()}
			onClick={toggleTheme}
			className={buttonClasses}
			title={showTooltip ? getTooltipText() : undefined}
			{...props}
		/>
	);
};

/**
 * Compact Theme Toggle - minimal version without label
 */
export const CompactThemeToggle: React.FC<
	Omit<ThemeToggleProps, "showLabel">
> = (props) => {
	return <ThemeToggle showLabel={false} {...props} />;
};

/**
 * Full Theme Toggle - with label text
 */
export const FullThemeToggle: React.FC<Omit<ThemeToggleProps, "showLabel">> = (
	props,
) => {
	return <ThemeToggle showLabel={true} {...props} />;
};

export default ThemeToggle;
