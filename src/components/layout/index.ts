/**
 * Layout Components for Waypaper Engine
 *
 * This file exports all layout components for easy importing
 * throughout the application.
 */

// Main layout components
export { AppLayout } from "./AppLayout";
export { Header } from "./Header";
export { Sidebar } from "./Sidebar";
export { Footer } from "./Footer";

// Layout utility components
export {
	LayoutContainer,
	LayoutSection,
	LayoutGrid,
	LayoutFlex,
} from "./AppLayout";

// Sidebar components
export {
	SidebarHeader,
	SidebarContent,
	SidebarFooter,
	SidebarMenu,
	SidebarMenuItem,
	SidebarSection,
} from "./Sidebar";

// Footer components
export {
	FooterLink,
	FooterDivider,
	FooterGroup,
} from "./Footer";

// Type exports
export type { AppLayoutProps } from "./AppLayout";
export type { HeaderProps } from "./Header";
export type { SidebarProps } from "./Sidebar";
export type { FooterProps } from "./Footer";
export type { LayoutContainerProps } from "./AppLayout";
export type { LayoutSectionProps } from "./AppLayout";
export type { LayoutGridProps } from "./AppLayout";
export type { LayoutFlexProps } from "./AppLayout";
export type { SidebarHeaderProps } from "./Sidebar";
export type { SidebarContentProps } from "./Sidebar";
export type { SidebarFooterProps } from "./Sidebar";
export type { SidebarMenuProps } from "./Sidebar";
export type { SidebarMenuItemProps } from "./Sidebar";
export type { SidebarSectionProps } from "./Sidebar";
export type { FooterLinkProps } from "./Footer";
export type { FooterDividerProps } from "./Footer";
export type { FooterGroupProps } from "./Footer";
