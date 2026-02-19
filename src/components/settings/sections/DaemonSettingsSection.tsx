import type React from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import DaemonStatusComponent from "../DaemonStatusComponent";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

interface DaemonSettingsSectionProps {
	className?: string;
}

interface Field {
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

const storageFields: Field[] = [
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
];

const commsFields: Field[] = [
	{
		key: "socket_path",
		label: "Socket Path",
		description: "Unix socket path for daemon communication",
		type: "path",
		placeholder: "/run/user/1000/waypaper-engine.sock",
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

const loggingFields: Field[] = [
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
];

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

	const handleChange = async (key: string, value: unknown) => {
		await saveConfigSection(section, { [key]: value });
	};

	const fieldError = (key: string) =>
		errors.find((e) => e.section === section && e.key === key)?.message;

	const renderField = (field: Field) => {
		const raw = config?.daemon?.[field.key as keyof typeof config.daemon];

		if (field.type === "select") {
			return (
				<SettingRow
					key={field.key}
					label={field.label}
					description={field.description}
					error={fieldError(field.key)}
				>
					<select
						className={cn(
							"select select-bordered select-sm w-44",
							fieldError(field.key) && "select-error",
						)}
						value={(raw as string) ?? ""}
						onChange={(e) => handleChange(field.key, e.target.value)}
					>
						{field.options?.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</SettingRow>
			);
		}

		if (field.type === "number") {
			return (
				<SettingRow
					key={field.key}
					label={field.label}
					description={field.description}
					error={fieldError(field.key)}
				>
					<input
						type="number"
						className={cn(
							"input input-bordered input-sm w-28",
							fieldError(field.key) && "input-error",
						)}
						value={(raw as number) ?? 0}
						onChange={(e) =>
							handleChange(field.key, parseInt(e.target.value, 10))
						}
						min={field.min}
						max={field.max}
						step={field.step}
					/>
				</SettingRow>
			);
		}

		return (
			<SettingRow
				key={field.key}
				label={field.label}
				description={field.description}
				error={fieldError(field.key)}
			>
				<input
					type="text"
					className={cn(
						"input input-bordered input-sm w-64",
						fieldError(field.key) && "input-error",
					)}
					value={(raw as string) ?? ""}
					onChange={(e) => handleChange(field.key, e.target.value)}
					placeholder={field.placeholder}
				/>
			</SettingRow>
		);
	};

	return (
		<div className={cn("space-y-0", className)}>
			<h2 className="text-lg font-semibold text-base-content mb-1">Daemon</h2>
			<p className="text-sm text-base-content/50 mb-4">
				Background daemon configuration and logging.
			</p>

			<DaemonStatusComponent />

			<SettingSectionHeader title="Storage" />
			{storageFields.map(renderField)}

			<SettingSectionHeader title="Communication" />
			{commsFields.map(renderField)}

			<SettingSectionHeader title="Logging" />
			{loggingFields.map(renderField)}
		</div>
	);
};

export default DaemonSettingsSection;
