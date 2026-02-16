/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Uses DaisyUI's drawer component for the sidebar.
 * The drawer checkbox is the single source of truth for open/closed state.
 */

import type React from "react";
import type { ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import { SidebarContent } from "./ModernSidebar";
import NavBar from "./NavBar";
import { useSettingsStore } from "../../stores/settingsStore";

export const DRAWER_CHECKBOX_ID = "sidebar-drawer";

export interface ModernAppLayoutProps {
	children: ReactNode;
	className?: string;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({
	children,
	className,
}) => {
	const { currentTheme, isDarkMode } = useTheme();
	const config = useSettingsStore((s) => s.config);

	if (!config) {
		return (
			<div className="min-h-screen bg-base-200 flex items-center justify-center">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	const containerClasses = cn(
		"h-screen theme-transition",
		isDarkMode ? "theme-dark" : "theme-light",
		className,
	);

	return (
		<div className={containerClasses} data-theme={currentTheme}>
			<div className="drawer h-screen">
				<input
					id={DRAWER_CHECKBOX_ID}
					type="checkbox"
					className="drawer-toggle"
				/>

				{/* Main content area */}
				<div className="drawer-content flex flex-col h-full overflow-hidden">
					<NavBar />
					<main className="flex-1 overflow-hidden bg-base-100">
						{children}
					</main>
				</div>

				{/* Sidebar */}
				<div className="drawer-side z-50">
					<label
						htmlFor={DRAWER_CHECKBOX_ID}
						aria-label="close sidebar"
						className="drawer-overlay"
					/>
					<SidebarContent />
				</div>
			</div>
		</div>
	);
};

export default ModernAppLayout;
