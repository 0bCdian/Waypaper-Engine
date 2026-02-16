/**
 * NavBar Component for Waypaper Engine
 *
 * Uses a <label> linked to the DaisyUI drawer-toggle checkbox
 * for the hamburger menu. No z-index needed -- the drawer handles stacking.
 */

import type React from "react";
import { useMonitorStore } from "../../stores/monitors";
import { cn } from "../../utils/cn";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";

export interface NavBarProps {
	className?: string;
}

export const NavBar: React.FC<NavBarProps> = ({ className }) => {
	const { monitorSelection, reQueryMonitors } = useMonitorStore();

	const handleMonitorSelect = async () => {
		try {
			await reQueryMonitors();
			// @ts-expect-error daisyui modal
			window.monitors.showModal();
		} catch (error) {
			console.error("Failed to query monitors:", error);
		}
	};

	const navbarClasses = cn(
		"navbar bg-base-100 border-b border-base-300 px-4 py-2 shrink-0",
		className,
	);

	return (
		<nav className={navbarClasses}>
			{/* Left side - Sidebar toggle */}
			<div className="navbar-start">
				<label
					htmlFor={DRAWER_CHECKBOX_ID}
					className="btn btn-ghost btn-sm drawer-button"
					aria-label="Toggle sidebar"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Menu</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M4 6h16M4 12h16M4 18h7"
						/>
					</svg>
				</label>
			</div>

			{/* Center - Monitor selection */}
			<div className="navbar-center">
				<button
					type="button"
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
						<title>Display</title>
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

			{/* Right side */}
			<div className="navbar-end">
				<div className="flex items-center gap-2" />
			</div>
		</nav>
	);
};

export default NavBar;
