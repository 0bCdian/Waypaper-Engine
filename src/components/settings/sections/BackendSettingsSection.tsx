/**
 * Backend Settings Section Component
 *
 * Handles all backend-specific settings from the [backend] section of the TOML config.
 * Uses accordion layout for better organization as requested.
 */

import React, { useState } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

/**
 * Backend Settings Section Props
 */
interface BackendSettingsSectionProps {
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
	type: "text" | "number" | "select";
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
}

/**
 * Backend Settings Section Component
 */
export const BackendSettingsSection: React.FC<BackendSettingsSectionProps> = ({
	className = "",
}) => {
	const {
		config,
		saveConfigSection,
		errors,
		showAdvancedSettings,
		setShowAdvancedSettings,
	} = useSettingsStore();
	const section: ConfigSection = "backend";
	const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
		new Set(["general"]),
	);

	// Define all backend settings fields
	const generalSettings: SettingField[] = [
		{
			key: "type",
			label: "Backend Type",
			description: "Wallpaper backend to use for setting wallpapers",
			type: "select",
			options: [
				{ value: "swww", label: "swww (Wayland)" },
				{ value: "feh", label: "feh (X11)" },
				{ value: "nitrogen", label: "nitrogen (X11)" },
				{ value: "custom", label: "Custom Script" },
			],
		},
	];

	const swwwSettings: SettingField[] = [
		{
			key: "swww.transition_type",
			label: "Transition Type",
			description: "Type of transition effect when changing wallpapers",
			type: "select",
			options: [
				{ value: "simple", label: "Simple" },
				{ value: "wipe", label: "Wipe" },
				{ value: "grow", label: "Grow" },
				{ value: "outer", label: "Outer" },
				{ value: "wave", label: "Wave" },
			],
		},
		{
			key: "swww.transition_duration",
			label: "Transition Duration (ms)",
			description: "Duration of the transition animation in milliseconds",
			type: "number",
			min: 50,
			max: 5000,
			step: 50,
		},
		{
			key: "swww.transition_step",
			label: "Transition Step",
			description: "Step size for transition effects (0-255)",
			type: "number",
			min: 0,
			max: 255,
			step: 1,
		},
		{
			key: "swww.transition_angle",
			label: "Transition Angle",
			description: "Angle for directional transitions (0-360 degrees)",
			type: "number",
			min: 0,
			max: 360,
			step: 1,
		},
		{
			key: "swww.transition_pos",
			label: "Transition Position",
			description: "Starting position for transitions",
			type: "select",
			options: [
				{ value: "center", label: "Center" },
				{ value: "top", label: "Top" },
				{ value: "bottom", label: "Bottom" },
				{ value: "left", label: "Left" },
				{ value: "right", label: "Right" },
			],
		},
		{
			key: "swww.transition_bezier",
			label: "Transition Bezier",
			description:
				"Bezier curve parameters for smooth transitions (x1,y1,x2,y2)",
			type: "text",
			placeholder: "0.25,0.1,0.25,1",
		},
		{
			key: "swww.transition_wave",
			label: "Transition Wave",
			description: "Wave parameters for wave transitions",
			type: "text",
			placeholder: "0,0,0,0",
		},
	];

	const handleValueChange = async (key: string, value: unknown) => {
		if (key.startsWith("swww.")) {
			// PATCH /config/backend expects SwwwConfig fields directly
			const swwwKey = key.replace("swww.", "");
			const swwwData = {
				...(config?.backend?.swww ?? {}),
				[swwwKey]: value,
			};
			await saveConfigSection(section, swwwData);
		} else {
			await saveConfigSection(section, { [key]: value });
		}
	};

	const getFieldError = (key: string) => {
		return errors.find(
			(error) => error.section === section && error.key === key,
		);
	};

	const toggleAccordion = (accordionId: string) => {
		const newExpanded = new Set(expandedAccordions);
		if (newExpanded.has(accordionId)) {
			newExpanded.delete(accordionId);
		} else {
			newExpanded.add(accordionId);
		}
		setExpandedAccordions(newExpanded);
	};

	const renderField = (field: SettingField) => {
		const currentValue = field.key.startsWith("swww.")
			? config?.backend?.swww?.[
					field.key.replace("swww.", "") as keyof typeof config.backend.swww
				]
			: config?.backend?.[field.key as keyof typeof config.backend];
		const error = getFieldError(field.key);

		if (field.type === "text") {
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
								type="text"
								className={cn(
									"input input-bordered input-sm",
									error && "input-error",
								)}
								value={(currentValue as string) || ""}
								onChange={(e) => handleValueChange(field.key, e.target.value)}
								placeholder={field.placeholder}
								disabled={false}
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
								disabled={false}
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
								disabled={false}
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

	const renderAccordion = (
		id: string,
		title: string,
		fields: SettingField[],
		description?: string,
	) => {
		const isExpanded = expandedAccordions.has(id);

		return (
			<div key={id} className="collapse collapse-arrow bg-base-200">
				<input
					type="checkbox"
					checked={isExpanded}
					onChange={() => toggleAccordion(id)}
				/>
				<div className="collapse-title text-md font-medium">
					<div className="flex items-center justify-between">
						<span>{title}</span>
						<span className="text-xs text-base-content/60">
							{fields.length} setting{fields.length !== 1 ? "s" : ""}
						</span>
					</div>
					{description && (
						<p className="text-xs text-base-content/60 mt-1 font-normal">
							{description}
						</p>
					)}
				</div>
				<div className="collapse-content">
					<div className="pt-4 space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{fields.map(renderField)}
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Section Header */}
			<div className="border-b border-base-300 pb-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-base-content">
							Backend Settings
						</h2>
						<p className="text-sm text-base-content/60 mt-1">
							Configure wallpaper backend and transition effects.
						</p>
					</div>
					<div className="form-control">
						<label className="label cursor-pointer gap-2">
							<span className="text-sm text-base-content/60">Advanced</span>
							<input
								type="checkbox"
								className="toggle toggle-sm"
								checked={showAdvancedSettings}
								onChange={(e) => setShowAdvancedSettings(e.target.checked)}
							/>
						</label>
					</div>
				</div>
			</div>

			{/* Accordion Layout */}
			<div className="space-y-4">
				{/* General Backend Settings */}
				{renderAccordion(
					"general",
					"General Backend",
					generalSettings,
					"Basic backend configuration",
				)}

				{/* swww Settings */}
				{config?.backend?.type === "swww" &&
					renderAccordion(
						"swww",
						"swww Transition Settings",
						swwwSettings,
						"Configure swww-specific transition effects and animations",
					)}

				{/* Future backends can be added here */}
				{config?.backend?.type === "feh" && (
					<div className="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							className="stroke-current shrink-0 w-6 h-6"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span className="text-sm">
							feh backend selected. Additional feh-specific settings will be
							available in a future update.
						</span>
					</div>
				)}

				{config?.backend?.type === "nitrogen" && (
					<div className="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							className="stroke-current shrink-0 w-6 h-6"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span className="text-sm">
							nitrogen backend selected. Additional nitrogen-specific settings
							will be available in a future update.
						</span>
					</div>
				)}

				{config?.backend?.type === "custom" && (
					<div className="alert alert-warning">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							className="stroke-current shrink-0 w-6 h-6"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
							></path>
						</svg>
						<span className="text-sm">
							Custom backend selected. You'll need to configure custom scripts
							manually.
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default BackendSettingsSection;
