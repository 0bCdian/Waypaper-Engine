/**
 * Simple DaisyUI Theme Selector Component
 *
 * This component provides a simple dropdown to select DaisyUI themes,
 * similar to how Upscayl handles theme switching.
 */

import React, { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

/**
 * DaisyUI Theme Selector Props
 */
interface DaisyUIThemeSelectorProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Simple DaisyUI Theme Selector Component
 */
export const DaisyUIThemeSelector: React.FC<DaisyUIThemeSelectorProps> = ({
	className = "",
}) => {
	const { currentTheme, setTheme, getAvailableThemes } = useTheme();
	const [isOpen, setIsOpen] = useState(false);

	// Get available themes
	const availableThemes = getAvailableThemes();

	// Handle theme selection
	const handleThemeSelect = (themeName: string) => {
		setTheme(themeName);
		setIsOpen(false);
	};

	return (
		<div className={`dropdown dropdown-end ${className}`}>
			{/* Trigger Button */}
			<button
				tabIndex={0}
				role="button"
				className="btn btn-ghost btn-sm gap-2"
				onClick={() => setIsOpen(!isOpen)}
				aria-label="Select theme"
				aria-expanded={isOpen}
				aria-haspopup="true"
			>
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
			</button>

			{/* Dropdown Content */}
			{isOpen && (
				<div className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-80 max-h-96 overflow-y-auto">
					{/* Theme List */}
					<ul className="space-y-1">
						{availableThemes.map((theme) => {
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
										<div className="flex gap-1">
											<div className="w-3 h-3 rounded-full bg-primary" />
											<div className="w-3 h-3 rounded-full bg-secondary" />
											<div className="w-3 h-3 rounded-full bg-accent" />
										</div>

										{/* Theme Info */}
										<div className="flex flex-col items-start flex-1">
											<span className="font-medium">{theme.displayName}</span>
											<span className="text-xs text-base-content/60">
												{theme.description}
											</span>
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

					{/* Footer */}
					<div className="divider my-2"></div>
					<div className="text-xs text-base-content/60 text-center">
						{availableThemes.length} DaisyUI theme
						{availableThemes.length !== 1 ? "s" : ""} available
					</div>
				</div>
			)}
		</div>
	);
};

export default DaisyUIThemeSelector;
