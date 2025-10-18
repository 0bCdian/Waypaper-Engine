/**
 * App Settings Section Component
 *
 * Handles all application-specific settings from the [app] section of the TOML config.
 */

import React, { useState } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import InlineThemeSelector from "../InlineThemeSelector";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

/**
 * App Settings Section Props
 */
interface AppSettingsSectionProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Setting field configuration
 */
interface SettingField {
	key: string;
	label: string;
	description: string;
	type: "boolean" | "number" | "select" | "theme";
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
}

/**
 * App Settings Section Component
 */
export const AppSettingsSection: React.FC<AppSettingsSectionProps> = ({
	className = "",
}) => {
	const { config, saveConfig, errors } = useSettingsStore();
	const section: ConfigSection = "app";
	const [themeAccordionOpen, setThemeAccordionOpen] = useState(false);
	const [activeThemeTab, setActiveThemeTab] = useState<"light" | "dark">(
		"dark",
	);

	// Define all app settings fields (excluding theme and gallery filters)
	const settingsFields: SettingField[] = [
		{
			key: "kill_daemon_on_exit",
			label: "Kill Daemon on Exit",
			description:
				"Terminate the background daemon when the application closes",
			type: "boolean",
		},
		{
			key: "notifications",
			label: "Notifications",
			description: "Enable desktop notifications for wallpaper changes",
			type: "boolean",
		},
		{
			key: "start_minimized",
			label: "Start Minimized",
			description: "Start the application minimized to system tray",
			type: "boolean",
		},
		{
			key: "minimize_instead_of_close",
			label: "Minimize Instead of Close",
			description: "Minimize to tray instead of closing the application",
			type: "boolean",
		},
		{
			key: "show_monitor_modal_on_start",
			label: "Show Monitor Modal on Start",
			description: "Show monitor selection modal when starting the application",
			type: "boolean",
		},
		{
			key: "sidebar_collapsed",
			label: "Sidebar Collapsed",
			description: "Start with the sidebar collapsed",
			type: "boolean",
		},
		{
			key: "random_image_monitor",
			label: "Random Image Monitor",
			description: "How random images are applied across monitors",
			type: "select",
			options: [
				{ value: "individual", label: "Individual" },
				{ value: "clone", label: "Clone" },
				{ value: "extend", label: "Extend" },
			],
		},
	];

	const handleValueChange = async (key: string, value: unknown) => {
		await saveConfig(section, key, value);
	};

	const getFieldError = (key: string) => {
		return errors.find(
			(error) => error.section === section && error.key === key,
		);
	};

	const renderField = (field: SettingField) => {
		const currentValue = config?.app?.[field.key as keyof typeof config.app];
		const error = getFieldError(field.key);

		if (field.type === "theme") {
			return (
				<div key={field.key} className="space-y-3">
					<div>
						<label className="text-sm font-medium text-base-content">
							{field.label}
						</label>
						<p className="text-xs text-base-content/60 mt-1">
							{field.description}
						</p>
					</div>
					<InlineThemeSelector
						onThemeChange={(themeName) =>
							handleValueChange(field.key, themeName)
						}
						showDescriptions={false}
					/>
				</div>
			);
		}

		if (field.type === "boolean") {
			return (
				<div key={field.key} className="card bg-base-200 shadow-sm">
					<div className="card-body p-4">
						<div className="form-control">
							<label className="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									className="toggle toggle-primary"
									checked={Boolean(currentValue)}
									onChange={(e) =>
										handleValueChange(field.key, e.target.checked)
									}
								/>
								<div>
									<div className="text-sm font-medium text-base-content">
										{field.label}
									</div>
									<div className="text-xs text-base-content/60">
										{field.description}
									</div>
								</div>
							</label>
							{error && (
								<div className="text-xs text-error mt-1">{error.message}</div>
							)}
						</div>
					</div>
				</div>
			);
		}

		if (field.type === "number") {
			return (
				<div key={field.key} className="card bg-base-200 shadow-sm">
					<div className="card-body p-4">
						<div className="form-control">
							<label className="label">
								<span className="text-sm font-medium text-base-content">
									{field.label}
								</span>
							</label>
							<input
								type="number"
								className={cn(
									"input input-bordered input-sm",
									error && "input-error",
								)}
								value={(currentValue as number) || 0}
								onChange={(e) =>
									handleValueChange(field.key, parseInt(e.target.value))
								}
								min={field.min}
								max={field.max}
								step={field.step}
							/>
							<div className="label">
								<span className="text-xs text-base-content/60">
									{field.description}
								</span>
							</div>
							{error && (
								<div className="text-xs text-error mt-1">{error.message}</div>
							)}
						</div>
					</div>
				</div>
			);
		}

		if (field.type === "select") {
			return (
				<div key={field.key} className="card bg-base-200 shadow-sm">
					<div className="card-body p-4">
						<div className="form-control flex flex-col gap-2">
							<label className="label">
								<span className="text-sm font-medium text-base-content">
									{field.label}
								</span>
							</label>
							<select
								className={cn(
									"select select-bordered select-sm",
									error && "select-error",
								)}
								value={(currentValue as string) || ""}
								onChange={(e) => handleValueChange(field.key, e.target.value)}
							>
								{field.options?.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<div className="label">
								<span className="text-xs text-base-content/60">
									{field.description}
								</span>
							</div>
							{error && (
								<div className="text-xs text-error mt-1">{error.message}</div>
							)}
						</div>
					</div>
				</div>
			);
		}

		return null;
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Section Header */}
			<div className="border-b border-base-300 pb-4">
				<h2 className="text-lg font-semibold text-base-content">
					Application Settings
				</h2>
				<p className="text-sm text-base-content/60 mt-1">
					Configure application behavior, appearance, and user interface
					preferences.
				</p>
			</div>

			{/* Theme Section - Accordion */}
			<div className="collapse collapse-arrow bg-base-200">
				<input
					type="checkbox"
					checked={themeAccordionOpen}
					onChange={(e) => setThemeAccordionOpen(e.target.checked)}
				/>
				<div className="collapse-title text-lg font-medium">
					<div className="flex items-center gap-2">
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
								d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
							/>
						</svg>
						Theme & Appearance
					</div>
				</div>
				<div className="collapse-content">
					<div className="pt-4">
						<div className="space-y-4">
							<div>
								<label className="text-sm font-medium text-base-content">
									Application Theme
								</label>
								<p className="text-xs text-base-content/60 mt-1">
									Choose the visual theme for the application interface
								</p>
							</div>

							{/* Theme Category Tabs */}
							<div className="tabs tabs-boxed">
								<button
									className={cn(
										"tab tab-sm",
										activeThemeTab === "dark" ? "tab-active" : "",
									)}
									onClick={() => setActiveThemeTab("dark")}
								>
									<svg
										className="w-4 h-4 mr-1"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
										/>
									</svg>
									Dark Themes
								</button>
								<button
									className={cn(
										"tab tab-sm",
										activeThemeTab === "light" ? "tab-active" : "",
									)}
									onClick={() => setActiveThemeTab("light")}
								>
									<svg
										className="w-4 h-4 mr-1"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
										/>
									</svg>
									Light Themes
								</button>
							</div>

							{/* Theme Selector with Category Filter */}
							<InlineThemeSelector
								onThemeChange={(themeName) =>
									handleValueChange("theme", themeName)
								}
								showDescriptions={true}
								categoryFilter={activeThemeTab}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Settings Fields - Bento Grid Layout */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{settingsFields.map(renderField)}
			</div>
		</div>
	);
};

export default AppSettingsSection;
