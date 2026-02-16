/**
 * Settings Tabs Component for Waypaper Engine
 *
 * Comprehensive settings interface with VS Code-style search, unified configuration,
 * and real-time TOML synchronization. Features accordion layouts and inline theme selection.
 */

import type React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import SettingsSearch from "./SettingsSearch";
import AppSettingsSection from "./sections/AppSettingsSection";
import DaemonSettingsSection from "./sections/DaemonSettingsSection";
import BackendSettingsSection from "./sections/BackendSettingsSection";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

/**
 * Settings Tabs props interface
 */
export interface SettingsTabsProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Tab configuration
 */
interface TabConfig {
	id: ConfigSection;
	label: string;
	component: React.ComponentType<{ className?: string }>;
	description: string;
	icon: React.ReactNode;
}

/**
 * Settings Tabs component
 */
export const SettingsTabs: React.FC<SettingsTabsProps> = ({ className }) => {
	const {
		lastSaved,
		errors,
		searchTerm,
		filteredSections,
		setSearchTerm,
		clearSearch,
		clearErrors,
	} = useSettingsStore(
		useShallow((s) => ({
			lastSaved: s.lastSaved,
			errors: s.errors,
			searchTerm: s.searchTerm,
			filteredSections: s.filteredSections,
			setSearchTerm: s.setSearchTerm,
			clearSearch: s.clearSearch,
			clearErrors: s.clearErrors,
		})),
	);

	const [activeTab, setActiveTab] = useState<ConfigSection>("app");

	// Clear errors when component unmounts
	useEffect(() => {
		return () => {
			clearErrors();
		};
	}, [clearErrors]);

	const tabs: TabConfig[] = [
		{
			id: "app",
			label: "Application",
			component: AppSettingsSection,
			description: "Application behavior, appearance, and UI preferences",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			),
		},
		{
			id: "daemon",
			label: "Daemon",
			component: DaemonSettingsSection,
			description: "Background daemon configuration and logging",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			),
		},
		{
			id: "backend",
			label: "Backend",
			component: BackendSettingsSection,
			description: "Wallpaper backend and transition settings",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			),
		},
	];

	// Filter tabs based on search
	const visibleTabs = tabs.filter((tab) => filteredSections.includes(tab.id));
	const activeTabConfig = tabs.find((tab) => tab.id === activeTab);
	const ActiveComponent = activeTabConfig?.component;

	const containerClasses = cn("h-full w-full flex flex-col", className);

	// Format last saved time
	const formatLastSaved = (timestamp: number | null) => {
		if (!timestamp) return "";
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (seconds < 60) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	};

	return (
		<div className={containerClasses}>
			{/* Header */}
			<div className="bg-base-100 border-b border-base-300 p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="text-primary-content"
							>
								<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						</div>
						<div>
							<h1 className="text-3xl font-bold text-base-content">Settings</h1>
							<p className="text-base-content/70 mt-1">
								Configure Waypaper Engine preferences and behavior
							</p>
						</div>
					</div>

					{/* Status Indicators */}
					<div className="flex items-center gap-4 text-sm">
						{lastSaved && (
							<div className="text-base-content/60">
								Last saved: {formatLastSaved(lastSaved)}
							</div>
						)}
						{errors.length > 0 && (
							<div className="flex items-center gap-2 text-error">
								<svg
									className="w-4 h-4"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fillRule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
										clipRule="evenodd"
									/>
								</svg>
								{errors.length} error{errors.length !== 1 ? "s" : ""}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Search Bar */}
			<div className="bg-base-100 border-b border-base-300 p-4">
				<SettingsSearch
					searchTerm={searchTerm}
					onSearchChange={setSearchTerm}
					onSearchClear={clearSearch}
					onNavigateToSection={setActiveTab}
					className="max-w-md"
				/>
			</div>

			{/* Tabs Navigation */}
			<div className="bg-base-100 border-b border-base-300 px-6">
				<div className="tabs tabs-boxed">
					{visibleTabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"tab tab-lg gap-2",
								activeTab === tab.id ? "tab-active" : "",
							)}
							title={tab.description}
						>
							{tab.icon}
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div className="flex-1 overflow-y-auto bg-base-100">
				{ActiveComponent && (
					<div className="p-6">
						<ActiveComponent />
					</div>
				)}
			</div>

			{/* Global Error Display */}
			{errors.length > 0 && (
				<div className="bg-error/10 border-t border-error/20 p-4">
					<div className="space-y-2">
						<div className="font-medium text-error">Configuration Errors:</div>
						{errors.map((error, index) => (
							<div
								key={`${error.section}-${error.key}-${index}`}
								className="text-sm text-error"
							>
								<span className="font-medium">
									{error.section}.{error.key}:
								</span>{" "}
								{error.message}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default SettingsTabs;
