/**
 * Settings Search Component for Waypaper Engine
 *
 * VS Code-style search functionality for settings with real-time filtering
 * and keyboard navigation support.
 */

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

/**
 * Settings Search Props
 */
interface SettingsSearchProps {
	/** Current search term */
	searchTerm: string;
	/** Callback when search term changes */
	onSearchChange: (term: string) => void;
	/** Callback when search is cleared */
	onSearchClear: () => void;
	/** Callback when Enter is pressed for navigation */
	onNavigateToSection?: (section: ConfigSection) => void;
	/** Additional CSS classes */
	className?: string;
	/** Placeholder text */
	placeholder?: string;
	/** Whether to show search suggestions */
	showSuggestions?: boolean;
}

/**
 * Search suggestion interface
 */
interface SearchSuggestion {
	section: ConfigSection;
	key: string;
	label: string;
	description: string;
	category: string;
}

/**
 * Common settings search suggestions
 */
const searchSuggestions: SearchSuggestion[] = [
	// App settings
	{
		section: "app",
		key: "theme",
		label: "Theme",
		description: "Application theme",
		category: "Appearance",
	},
	{
		section: "app",
		key: "notifications",
		label: "Notifications",
		description: "Enable desktop notifications",
		category: "Appearance",
	},
	{
		section: "app",
		key: "start_minimized",
		label: "Start Minimized",
		description: "Start application minimized",
		category: "Behavior",
	},
	{
		section: "app",
		key: "minimize_instead_of_close",
		label: "Minimize Instead of Close",
		description: "Minimize to tray instead of closing",
		category: "Behavior",
	},
	{
		section: "app",
		key: "images_per_page",
		label: "Images Per Page",
		description: "Number of images per page",
		category: "Gallery",
	},
	{
		section: "app",
		key: "sort_by",
		label: "Sort By",
		description: "Default sort order for images",
		category: "Gallery",
	},

	// Daemon settings
	{
		section: "daemon",
		key: "log_level",
		label: "Log Level",
		description: "Daemon logging level",
		category: "Logging",
	},
	{
		section: "daemon",
		key: "log_file",
		label: "Log File",
		description: "Path to log file",
		category: "Logging",
	},
	{
		section: "daemon",
		key: "images_dir",
		label: "Images Directory",
		description: "Directory for cached images",
		category: "Storage",
	},
	{
		section: "daemon",
		key: "thumbnails_dir",
		label: "Thumbnails Directory",
		description: "Directory for thumbnails",
		category: "Storage",
	},

	// Backend settings
	{
		section: "backend",
		key: "type",
		label: "Backend Type",
		description: "Wallpaper backend (swww, feh, etc.)",
		category: "Backend",
	},
	{
		section: "backend",
		key: "swww.transition_type",
		label: "Transition Type",
		description: "Type of wallpaper transition",
		category: "Transitions",
	},
	{
		section: "backend",
		key: "swww.transition_duration",
		label: "Transition Duration",
		description: "Duration of transitions in ms",
		category: "Transitions",
	},
	{
		section: "backend",
		key: "swww.transition_step",
		label: "Transition Step",
		description: "Step size for transitions",
		category: "Transitions",
	},

	// Monitor settings
	{
		section: "monitors",
		key: "image_set_type",
		label: "Image Set Type",
		description: "How images are set across monitors",
		category: "Monitors",
	},
	{
		section: "monitors",
		key: "selected_monitors",
		label: "Selected Monitors",
		description: "Monitors to use for wallpapers",
		category: "Monitors",
	},
];

/**
 * Settings Search Component
 */
export const SettingsSearch: React.FC<SettingsSearchProps> = ({
	searchTerm,
	onSearchChange,
	onSearchClear,
	onNavigateToSection,
	className = "",
	placeholder = "Search settings...",
	showSuggestions = true,
}) => {
	const [isFocused, setIsFocused] = useState(false);
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const prevSearchTermRef = useRef(searchTerm);

	const filteredSuggestions = searchTerm.trim()
		? searchSuggestions.filter(
				(suggestion) =>
					suggestion.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
					suggestion.description
						.toLowerCase()
						.includes(searchTerm.toLowerCase()) ||
					suggestion.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
					suggestion.category.toLowerCase().includes(searchTerm.toLowerCase()),
			)
		: [];

	if (prevSearchTermRef.current !== searchTerm) {
		prevSearchTermRef.current = searchTerm;
		setSelectedSuggestionIndex(-1);
	}

	// Handle keyboard navigation
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (!showSuggestions || filteredSuggestions.length === 0) {
			// Handle Enter key for navigation when no suggestions
			if (event.key === "Enter" && onNavigateToSection) {
				event.preventDefault();
				// Try to find a matching section based on search term
				const searchLower = searchTerm.toLowerCase();
				let targetSection: ConfigSection | null = null;

				if (
					searchLower.includes("app") ||
					searchLower.includes("application") ||
					searchLower.includes("theme") ||
					searchLower.includes("notification")
				) {
					targetSection = "app";
				} else if (
					searchLower.includes("daemon") ||
					searchLower.includes("log") ||
					searchLower.includes("database")
				) {
					targetSection = "daemon";
				} else if (
					searchLower.includes("backend") ||
					searchLower.includes("swww") ||
					searchLower.includes("transition")
				) {
					targetSection = "backend";
				}

				if (targetSection) {
					onNavigateToSection(targetSection);
					inputRef.current?.blur();
				}
			}
			return;
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setSelectedSuggestionIndex((prev) =>
					prev < filteredSuggestions.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				event.preventDefault();
				setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				event.preventDefault();
				if (selectedSuggestionIndex >= 0) {
					const suggestion = filteredSuggestions[selectedSuggestionIndex];
					onSearchChange(suggestion.key);
					inputRef.current?.blur();
				} else if (onNavigateToSection) {
					// Navigate to the section of the first suggestion
					const firstSuggestion = filteredSuggestions[0];
					if (firstSuggestion) {
						onNavigateToSection(firstSuggestion.section);
						inputRef.current?.blur();
					}
				}
				break;
			case "Escape":
				event.preventDefault();
				onSearchClear();
				inputRef.current?.blur();
				break;
		}
	};

	// Handle suggestion click
	const handleSuggestionClick = (suggestion: SearchSuggestion) => {
		onSearchChange(suggestion.key);
		inputRef.current?.blur();
	};

	// Handle input change
	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		onSearchChange(event.target.value);
	};

	// Handle clear button click
	const handleClearClick = () => {
		onSearchClear();
		inputRef.current?.focus();
	};

	// Scroll selected suggestion into view
	useEffect(() => {
		if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
			const selectedElement = suggestionsRef.current.children[
				selectedSuggestionIndex
			] as HTMLElement;
			if (selectedElement) {
				selectedElement.scrollIntoView({ block: "nearest" });
			}
		}
	}, [selectedSuggestionIndex]);

	return (
		<div className={cn("relative", className)}>
			{/* Search Input */}
			<div className="relative">
				<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<svg
						className="h-4 w-4 text-base-content/40"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>

				<input
					ref={inputRef}
					type="text"
					className={cn(
						"input input-bordered w-full pl-10 pr-10",
						"focus:input-primary transition-colors duration-200",
						isFocused && "ring-2 ring-primary/20",
					)}
					placeholder={placeholder}
					value={searchTerm}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsFocused(true)}
					onBlur={() => {
						// Delay blur to allow clicking on suggestions
						setTimeout(() => setIsFocused(false), 150);
					}}
				/>

				{/* Clear Button */}
				{searchTerm && (
					<button
						className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-base-content/60 transition-colors"
						onClick={handleClearClick}
						type="button"
					>
						<svg
							className="h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				)}
			</div>

			{/* Search Suggestions */}
			{showSuggestions && isFocused && filteredSuggestions.length > 0 && (
				<div
					ref={suggestionsRef}
					className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
				>
					{filteredSuggestions.map((suggestion, index) => (
						<button
							key={`${suggestion.section}-${suggestion.key}`}
							className={cn(
								"w-full px-4 py-3 text-left hover:bg-base-200 transition-colors",
								"border-b border-base-200 last:border-b-0",
								index === selectedSuggestionIndex && "bg-primary/10",
							)}
							onClick={() => handleSuggestionClick(suggestion)}
						>
							<div className="flex items-center justify-between">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">
											{suggestion.label}
										</span>
										<span className="text-xs text-base-content/60 bg-base-200 px-2 py-0.5 rounded">
											{suggestion.category}
										</span>
									</div>
									<p className="text-xs text-base-content/60 mt-1 truncate">
										{suggestion.description}
									</p>
									<p className="text-xs text-base-content/40 mt-1 font-mono">
										{suggestion.section}.{suggestion.key}
									</p>
								</div>
								<svg
									className="h-4 w-4 text-base-content/40"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</div>
						</button>
					))}
				</div>
			)}

			{/* Search Tips */}
			{isFocused && !searchTerm && (
				<div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-4">
					<div className="text-sm text-base-content/60 space-y-2">
						<div className="font-medium text-base-content">Search Tips:</div>
						<ul className="space-y-1 text-xs">
							<li>• Search by setting name, description, or category</li>
							<li>
								• Use <kbd className="kbd kbd-xs">↑</kbd>{" "}
								<kbd className="kbd kbd-xs">↓</kbd> to navigate suggestions
							</li>
							<li>
								• Press <kbd className="kbd kbd-xs">Enter</kbd> to select a
								suggestion
							</li>
							<li>
								• Press <kbd className="kbd kbd-xs">Esc</kbd> to clear search
							</li>
						</ul>
					</div>
				</div>
			)}
		</div>
	);
};

export default SettingsSearch;
