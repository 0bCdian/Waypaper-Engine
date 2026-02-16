/**
 * NavBar Component for Waypaper Engine
 *
 * A modern navbar implementation following DaisyUI 5 best practices.
 * Features monitor selection and clean design.
 */

import React from "react";
import { useMonitorStore } from "../../stores/monitors";
import { useSidebarState } from "../../hooks/useSidebarState";
import { cn } from "../../utils/cn";

/**
 * NavBar props interface
 */
export interface NavBarProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * NavBar component
 */
export const NavBar: React.FC<NavBarProps> = ({ className }) => {
	const { monitorSelection, reQueryMonitors } = useMonitorStore();
	const { toggle: toggleSidebar } = useSidebarState();

	const handleMonitorSelect = async () => {
		try {
			await reQueryMonitors();
			// @ts-expect-error daisyui
			window.monitors.showModal();
		} catch (error) {
			console.error("Failed to query monitors:", error);
		}
	};

	const handleSidebarToggle = () => {
		toggleSidebar();
	};

	const navbarClasses = cn(
		"navbar bg-base-100 border-b border-base-300 px-4 py-2 relative z-50 shrink-0",
		className,
	);

	return (
		<nav className={navbarClasses}>
			{/* Left side - Sidebar toggle */}
			<div className="navbar-start">
				<div className="flex items-center gap-2">
					{/* Sidebar toggle button */}
					<button
						className="btn btn-ghost btn-sm"
						onClick={handleSidebarToggle}
						aria-label="Toggle sidebar"
						title="Toggle sidebar"
					>
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
								d="M4 6h16M4 12h16M4 18h7"
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* Center - Monitor selection */}
			<div className="navbar-center">
				<button
					onClick={handleMonitorSelect}
					className="btn btn-primary btn-lg w-full max-w-md text-ellipsis rounded-lg text-xl font-medium transition-all duration-200 hover:btn-primary-focus"
					aria-label="Select display monitor"
					title={
						monitorSelection.selectedMonitors.length > 0
							? monitorSelection.selectedMonitors.join(", ")
							: "Select display"
					}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="mr-2 h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
						/>
					</svg>
					<span className="truncate">
						{monitorSelection.selectedMonitors.length > 0
							? monitorSelection.selectedMonitors.join(", ")
							: "Select Display"}
					</span>
				</button>
			</div>

			{/* Right side - Empty for now, can add theme selector or other controls */}
			<div className="navbar-end">
				<div className="flex items-center gap-2">
					{/* Placeholder for future right-side content */}
				</div>
			</div>
		</nav>
	);
};

export default NavBar;
