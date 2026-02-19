import type React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDesignSystemStore } from "@/stores/designSystemStore";
import { useShallow } from "zustand/react/shallow";
import SettingsSearch from "./SettingsSearch";
import AppSettingsSection from "./sections/AppSettingsSection";
import DaemonSettingsSection from "./sections/DaemonSettingsSection";
import BackendSettingsSection from "./sections/BackendSettingsSection";
import WallhavenSettingsSection from "./sections/WallhavenSettingsSection";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

export interface SettingsTabsProps {
	className?: string;
}

interface NavItem {
	id: ConfigSection;
	label: string;
	component: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
	{ id: "app", label: "General", component: AppSettingsSection },
	{ id: "daemon", label: "Daemon", component: DaemonSettingsSection },
	{ id: "backend", label: "Backend", component: BackendSettingsSection },
	{ id: "wallhaven", label: "Wallhaven", component: WallhavenSettingsSection },
];

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ className }) => {
	const {
		errors,
		searchTerm,
		filteredSections,
		setSearchTerm,
		clearSearch,
		clearErrors,
	} = useSettingsStore(
		useShallow((s) => ({
			errors: s.errors,
			searchTerm: s.searchTerm,
			filteredSections: s.filteredSections,
			setSearchTerm: s.setSearchTerm,
			clearSearch: s.clearSearch,
			clearErrors: s.clearErrors,
		})),
	);

	const isNeo = useDesignSystemStore((s) => s.designMode === "neobrutalist");
	const [activeSection, setActiveSection] = useState<ConfigSection>("app");

	useEffect(() => () => clearErrors(), [clearErrors]);

	const visibleNav = navItems.filter((n) => filteredSections.includes(n.id));
	const ActiveComponent = navItems.find(
		(n) => n.id === activeSection,
	)?.component;

	return (
		<div className={cn("h-full w-full flex", className)}>
			{/* ── Sidebar ──────────────────────────────────────────── */}
			<aside
				className={cn(
					"w-56 flex-shrink-0 flex flex-col border-r border-base-content/10 bg-base-100",
					isNeo && "border-r-2 border-base-content/80",
				)}
			>
				{/* Search */}
				<div className="p-3 border-b border-base-content/5">
					<SettingsSearch
						searchTerm={searchTerm}
						onSearchChange={setSearchTerm}
						onSearchClear={clearSearch}
						onNavigateToSection={setActiveSection}
						compact
					/>
				</div>

				{/* Navigation */}
				<nav className="flex-1 overflow-y-auto py-2 px-2">
					{visibleNav.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setActiveSection(item.id)}
							className={cn(
								"w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
								activeSection === item.id
									? "bg-base-content/10 font-medium text-base-content"
									: "text-base-content/60 hover:bg-base-content/5 hover:text-base-content",
							)}
						>
							{item.label}
						</button>
					))}
				</nav>

				{/* Error badge in sidebar footer */}
				{errors.length > 0 && (
					<div className="p-3 border-t border-base-content/5">
						<div className="flex items-center gap-2 text-error text-xs">
							<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fillRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
									clipRule="evenodd"
								/>
							</svg>
							{errors.length} error{errors.length !== 1 ? "s" : ""}
						</div>
					</div>
				)}
			</aside>

			{/* ── Content ──────────────────────────────────────────── */}
			<main className="flex-1 overflow-y-auto">
				{ActiveComponent && (
					<div className="max-w-2xl mx-auto px-8 py-6">
						<ActiveComponent />
					</div>
				)}
			</main>
		</div>
	);
};

export default SettingsTabs;
