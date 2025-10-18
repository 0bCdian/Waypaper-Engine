/**
 * Modern App Layout Component for Waypaper Engine
 *
 * A modern layout implementation inspired by Upscayl's design.
 * Uses the new ModernSidebar with toggle functionality.
 */

import React, { ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import ModernSidebar from "./ModernSidebar";
import NavBar from "./NavBar";
import { useUnifiedConfigStore } from "../../stores/unifiedConfig";
/**
 * Modern App Layout props interface
 */
export interface ModernAppLayoutProps {
	/** Children content */
	children: ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to show sidebar */
	showSidebar?: boolean;
	/** Whether to show header */
	showHeader?: boolean;
	/** Whether to show footer */
	showFooter?: boolean;
}

/**
 * Modern App Layout component
 */
export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({
	children,
	className,
}) => {
	const { currentTheme, isDarkMode } = useTheme();
	const { config } = useUnifiedConfigStore();

	// Show loading state if config is not yet loaded
	if (!config) {
		return (
			<div className="min-h-screen bg-base-200 flex items-center justify-center">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	// Main container classes
	const containerClasses = cn(
		"h-screen theme-transition relative overflow-hidden",
		isDarkMode ? "theme-dark" : "theme-light",
		className,
	);

	return (
		<div className={containerClasses} data-theme={currentTheme}>
			<ModernSidebar />
			<div className="flex flex-col h-full w-full">
				<NavBar />
				<main className="flex-1 overflow-hidden bg-base-100">{children}</main>
			</div>
		</div>
	);
};

export default ModernAppLayout;
