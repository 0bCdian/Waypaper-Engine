/**
 * Daemon Settings Section Component
 *
 * Handles all daemon-specific settings from the [daemon] section of the TOML config.
 */

import type React from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import DaemonStatusComponent from "../DaemonStatusComponent";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

/**
 * Daemon Settings Section Props
 */
interface DaemonSettingsSectionProps {
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
	type: "text" | "number" | "select" | "path";
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
}

/**
 * Daemon Settings Section Component
 */
export const DaemonSettingsSection: React.FC<DaemonSettingsSectionProps> = ({
	className = "",
}) => {
	const { config, saveConfigSection, errors } = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
			errors: s.errors,
		})),
	);
	const section: ConfigSection = "daemon";

	// Define all daemon settings fields (aligned with daemon/internal/config/types.go)
	const settingsFields: SettingField[] = [
		{
			key: "database_dir",
			label: "Database Directory",
			description: "Directory where CloverDB database files are stored",
			type: "path",
			placeholder: "~/.local/share/waypaper-engine/db",
		},
		{
			key: "images_dir",
			label: "Images Directory",
			description: "Directory where imported images are cached",
			type: "path",
			placeholder: "~/.local/share/waypaper-engine/images",
		},
		{
			key: "thumbnails_dir",
			label: "Thumbnails Directory",
			description: "Directory where generated thumbnails are stored",
			type: "path",
			placeholder: "~/.cache/waypaper-engine/thumbnails",
		},
		{
			key: "socket_path",
			label: "Socket Path",
			description: "Unix socket path for daemon communication",
			type: "path",
			placeholder: "/run/user/1000/waypaper-engine.sock",
		},
		{
			key: "log_level",
			label: "Log Level",
			description: "Minimum log level to record",
			type: "select",
			options: [
				{ value: "debug", label: "Debug" },
				{ value: "info", label: "Info" },
				{ value: "warn", label: "Warning" },
				{ value: "error", label: "Error" },
			],
		},
		{
			key: "log_file",
			label: "Log File",
			description: "Path to the daemon log file",
			type: "path",
			placeholder: "~/.local/share/waypaper-engine/daemon.log",
		},
		{
			key: "log_max_size_mb",
			label: "Log Max Size (MB)",
			description: "Maximum size of log file in megabytes before rotation",
			type: "number",
			min: 1,
			max: 1000,
			step: 1,
		},
		{
			key: "log_max_backups",
			label: "Log Max Backups",
			description: "Maximum number of rotated log file backups to keep",
			type: "number",
			min: 1,
			max: 10,
			step: 1,
		},
		{
			key: "compositor",
			label: "Compositor",
			description: "Compositor detection mode",
			type: "select",
			options: [
				{ value: "auto", label: "Auto-detect" },
				{ value: "wayland", label: "Wayland" },
				{ value: "x11", label: "X11" },
			],
		},
	];

	const handleValueChange = async (key: string, value: unknown) => {
		await saveConfigSection(section, { [key]: value });
	};

	const getFieldError = (key: string) => {
		return errors.find(
			(error) => error.section === section && error.key === key,
		);
	};

	const renderField = (field: SettingField) => {
		const currentValue =
			config?.daemon?.[field.key as keyof typeof config.daemon];
		const error = getFieldError(field.key);

		if (field.type === "text" || field.type === "path") {
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
									handleValueChange(field.key, parseInt(e.target.value, 10))
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

	return (
		<div className={cn("space-y-6", className)}>
			{/* Section Header */}
			<div className="border-b border-base-300 pb-4">
				<h2 className="text-lg font-semibold text-base-content">
					Daemon Settings
				</h2>
				<p className="text-sm text-base-content/60 mt-1">
					Configure the background daemon behavior, logging, and file paths.
				</p>
			</div>

			{/* Daemon Status */}
			<DaemonStatusComponent />

			{/* Storage Settings */}
			<div className="space-y-4">
				<h3 className="text-md font-medium text-base-content">Storage</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{settingsFields
						.filter((field) =>
							["database_dir", "images_dir", "thumbnails_dir"].includes(
								field.key,
							),
						)
						.map(renderField)}
				</div>
			</div>

			{/* Communication Settings */}
			<div className="space-y-4">
				<h3 className="text-md font-medium text-base-content">Communication</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{settingsFields
						.filter((field) =>
							["socket_path", "compositor"].includes(field.key),
						)
						.map(renderField)}
				</div>
			</div>

			{/* Logging Settings */}
			<div className="space-y-4">
				<h3 className="text-md font-medium text-base-content">Logging</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{settingsFields
						.filter((field) =>
							[
								"log_level",
								"log_file",
								"log_max_size_mb",
								"log_max_backups",
							].includes(field.key),
						)
						.map(renderField)}
				</div>
			</div>
		</div>
	);
};

export default DaemonSettingsSection;
