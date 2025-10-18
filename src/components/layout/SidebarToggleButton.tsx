/**
 * Sidebar Toggle Button Component
 *
 * A chevron button that toggles the sidebar visibility, inspired by Upscayl's design.
 * Uses semantic colors and follows DaisyUI's design philosophy.
 */

import React from "react";
import { cn } from "../../utils/cn";

/**
 * Sidebar Toggle Button props interface
 */
export interface SidebarToggleButtonProps {
	/** Whether sidebar is collapsed */
	collapsed: boolean;
	/** Toggle handler */
	onToggle: () => void;
	/** Whether sidebar is on the right */
	right?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Sidebar Toggle Button component
 */
export const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({
	collapsed,
	onToggle,
	right = false,
	className,
}) => {
	// Position classes based on sidebar position
	const positionClasses = right
		? "absolute -left-0 top-1/2 z-50 -translate-y-1/2 -translate-x-1/2"
		: "absolute -right-0 top-1/2 z-50 -translate-y-1/2 translate-x-1/2";

	// Button classes
	const buttonClasses = cn(
		"btn btn-circle bg-base-100 border-base-300 hover:bg-base-200",
		"shadow-lg transition-all duration-300 ease-in-out",
		"p-3 w-12 h-12",
		positionClasses,
		className,
	);

	// Chevron direction based on collapsed state and position
	const chevronDirection = right
		? collapsed
			? "right"
			: "left"
		: collapsed
			? "left"
			: "right";

	return (
		<button
			onClick={onToggle}
			className={buttonClasses}
			aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
			title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="transition-transform duration-300"
			>
				{chevronDirection === "left" ? (
					<path d="m15 18-6-6 6-6" />
				) : (
					<path d="m9 18 6-6-6-6" />
				)}
			</svg>
		</button>
	);
};

export default SidebarToggleButton;
