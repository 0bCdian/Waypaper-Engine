/**
 * Sidebar Component for Waypaper Engine
 *
 * Application sidebar component with navigation, theme controls, and user actions.
 * Integrates with the theme system and provides responsive design.
 */

import React, { ReactNode } from "react";
import { cn } from "../../utils/cn";
import SidebarToggleButton from "./SidebarToggleButton";

/**
 * Sidebar props interface
 */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
	/** Whether sidebar is open */
	open?: boolean;
	/** Whether sidebar is collapsible */
	collapsible?: boolean;
	/** Sidebar width */
	width?: "sm" | "md" | "lg";
	/** Whether sidebar is on the right */
	right?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
	/** Toggle handler */
	onToggle?: () => void;
}

/**
 * Sidebar component
 */
export const Sidebar: React.FC<SidebarProps> = ({
	open = true,
	collapsible = true,
	width = "md",
	right = false,
	className,
	children,
	onToggle,
	...props
}) => {
	// Width classes
	const widthClasses = {
		sm: "w-48",
		md: "w-64",
		lg: "w-80",
	};

	// Sidebar classes
	const sidebarClasses = cn(
		"sidebar bg-base-200 border-r border-base-300 shrink-0 theme-transition relative",
		widthClasses[width],
		!open && "hidden",
		right && "border-l border-r-0",
		className,
	);

	return (
		<aside className={sidebarClasses} {...props}>
			{/* Toggle Button */}
			{collapsible && onToggle && (
				<SidebarToggleButton
					collapsed={!open}
					onToggle={onToggle}
					right={right}
				/>
			)}

			<div className="flex flex-col h-full">{children}</div>
		</aside>
	);
};

/**
 * Sidebar Header component
 */
export interface SidebarHeaderProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** Header title */
	title?: string;
	/** Header subtitle */
	subtitle?: string;
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
	title,
	subtitle,
	className,
	children,
	...props
}) => {
	const headerClasses = cn(
		"sidebar-header p-4 border-b border-base-300",
		className,
	);

	return (
		<div className={headerClasses} {...props}>
			{title && (
				<h2 className="text-lg font-semibold text-base-content">{title}</h2>
			)}
			{subtitle && (
				<p className="text-sm text-base-content/70 mt-1">{subtitle}</p>
			)}
			{children}
		</div>
	);
};

/**
 * Sidebar Content component
 */
export interface SidebarContentProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
	className,
	children,
	...props
}) => {
	const contentClasses = cn(
		"sidebar-content flex-1 overflow-y-auto p-4",
		className,
	);

	return (
		<div className={contentClasses} {...props}>
			{children}
		</div>
	);
};

/**
 * Sidebar Footer component
 */
export interface SidebarFooterProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
	className,
	children,
	...props
}) => {
	const footerClasses = cn(
		"sidebar-footer p-4 border-t border-base-300",
		className,
	);

	return (
		<div className={footerClasses} {...props}>
			{children}
		</div>
	);
};

/**
 * Sidebar Menu component
 */
export interface SidebarMenuProps
	extends React.HTMLAttributes<HTMLUListElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
	className,
	children,
	...props
}) => {
	const menuClasses = cn("menu menu-vertical w-full", className);

	return (
		<ul className={menuClasses} {...props}>
			{children}
		</ul>
	);
};

/**
 * Sidebar Menu Item component
 */
export interface SidebarMenuItemProps
	extends React.LiHTMLAttributes<HTMLLIElement> {
	/** Whether item is active */
	active?: boolean;
	/** Whether item is disabled */
	disabled?: boolean;
	/** Item icon */
	icon?: ReactNode;
	/** Item label */
	label: string;
	/** Item description */
	description?: string;
	/** Click handler */
	onClick?: () => void;
	/** Additional CSS classes */
	className?: string;
}

export const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
	active = false,
	disabled = false,
	icon,
	label,
	description,
	onClick,
	className,
	...props
}) => {
	const itemClasses = cn(
		"menu-item",
		active && "active",
		disabled && "disabled",
		className,
	);

	return (
		<li className={itemClasses} {...props}>
			<button
				className="w-full text-left p-2 rounded-lg hover:bg-base-300 transition-colors"
				onClick={onClick}
				disabled={disabled}
			>
				<div className="flex items-center gap-3">
					{icon && <span className="shrink-0">{icon}</span>}
					<div className="flex-1 min-w-0">
						<div className="font-medium text-base-content">{label}</div>
						{description && (
							<div className="text-sm text-base-content/70">{description}</div>
						)}
					</div>
				</div>
			</button>
		</li>
	);
};

/**
 * Sidebar Section component
 */
export interface SidebarSectionProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** Section title */
	title?: string;
	/** Additional CSS classes */
	className?: string;
	/** Children content */
	children?: ReactNode;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
	title,
	className,
	children,
	...props
}) => {
	const sectionClasses = cn("sidebar-section mb-6", className);

	return (
		<div className={sectionClasses} {...props}>
			{title && (
				<h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-wide mb-2">
					{title}
				</h3>
			)}
			{children}
		</div>
	);
};

export default Sidebar;
