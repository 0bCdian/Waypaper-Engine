import type React from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

interface BackendSettingsSectionProps {
	className?: string;
}

interface Field {
	key: string;
	label: string;
	description: string;
	type: "text" | "number" | "select" | "checkbox";
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
}

const swwwFields: Field[] = [
	{
		key: "swww.transition_type",
		label: "Transition Type",
		description: "Type of transition effect when changing wallpapers",
		type: "select",
		options: [
			{ value: "none", label: "None" },
			{ value: "simple", label: "Simple" },
			{ value: "fade", label: "Fade" },
			{ value: "left", label: "Left" },
			{ value: "right", label: "Right" },
			{ value: "top", label: "Top" },
			{ value: "bottom", label: "Bottom" },
			{ value: "wipe", label: "Wipe" },
			{ value: "wave", label: "Wave" },
			{ value: "grow", label: "Grow" },
			{ value: "center", label: "Center" },
			{ value: "any", label: "Any" },
			{ value: "outer", label: "Outer" },
			{ value: "random", label: "Random" },
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
			{ value: "top-left", label: "Top Left" },
			{ value: "top-right", label: "Top Right" },
			{ value: "bottom-left", label: "Bottom Left" },
			{ value: "bottom-right", label: "Bottom Right" },
		],
	},
	{
		key: "swww.transition_bezier",
		label: "Transition Bezier",
		description: "Bezier curve parameters (x1,y1,x2,y2)",
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
	{
		key: "swww.transition_fps",
		label: "Transition FPS",
		description: "Target frames per second for the transition animation",
		type: "number",
		min: 1,
		max: 244,
		step: 1,
	},
	{
		key: "swww.resize",
		label: "Resize Mode",
		description: "How the image is fitted to the monitor",
		type: "select",
		options: [
			{ value: "crop", label: "Crop" },
			{ value: "fit", label: "Fit" },
			{ value: "no", label: "No Resize" },
			{ value: "stretch", label: "Stretch" },
		],
	},
	{
		key: "swww.fill_color",
		label: "Fill Color",
		description: 'Color for empty space when resize is "fit" (hex without #)',
		type: "text",
		placeholder: "000000",
	},
	{
		key: "swww.filter_type",
		label: "Filter Type",
		description: "Resampling filter used when resizing images",
		type: "select",
		options: [
			{ value: "Lanczos3", label: "Lanczos3" },
			{ value: "Bilinear", label: "Bilinear" },
			{ value: "CatmullRom", label: "CatmullRom" },
			{ value: "Mitchell", label: "Mitchell" },
			{ value: "Nearest", label: "Nearest" },
		],
	},
	{
		key: "swww.invert_y",
		label: "Invert Y",
		description: "Invert the y-axis for transition animations",
		type: "checkbox",
	},
];

export const BackendSettingsSection: React.FC<BackendSettingsSectionProps> = ({
	className = "",
}) => {
	const {
		config,
		saveConfigSection,
		errors,
		showAdvancedSettings,
		setShowAdvancedSettings,
	} = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
			errors: s.errors,
			showAdvancedSettings: s.showAdvancedSettings,
			setShowAdvancedSettings: s.setShowAdvancedSettings,
		})),
	);
	const section: ConfigSection = "backend";

	const handleChange = async (key: string, value: unknown) => {
		if (key.startsWith("swww.")) {
			const swwwKey = key.replace("swww.", "");
			const swwwData = { ...(config?.backend?.swww ?? {}), [swwwKey]: value };
			await saveConfigSection(section, swwwData);
		} else {
			await saveConfigSection(section, { [key]: value });
		}
	};

	const fieldError = (key: string) =>
		errors.find((e) => e.section === section && e.key === key)?.message;

	const renderField = (field: Field) => {
		const raw = field.key.startsWith("swww.")
			? config?.backend?.swww?.[
					field.key.replace("swww.", "") as keyof typeof config.backend.swww
				]
			: config?.backend?.[field.key as keyof typeof config.backend];

		if (field.type === "checkbox") {
			return (
				<SettingRow
					key={field.key}
					label={field.label}
					description={field.description}
					error={fieldError(field.key)}
				>
					<input
						type="checkbox"
						className="toggle toggle-primary"
						checked={!!raw}
						onChange={(e) => handleChange(field.key, e.target.checked)}
					/>
				</SettingRow>
			);
		}

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
						"input input-bordered input-sm w-48",
						fieldError(field.key) && "input-error",
					)}
					value={(raw as string) ?? ""}
					onChange={(e) => handleChange(field.key, e.target.value)}
					placeholder={field.placeholder}
				/>
			</SettingRow>
		);
	};

	const backendType = config?.backend?.type;

	return (
		<div className={cn("space-y-0", className)}>
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="text-lg font-semibold text-base-content mb-1">
						Backend
					</h2>
					<p className="text-sm text-base-content/50">
						Wallpaper backend and transition settings.
					</p>
				</div>
				<label className="flex items-center gap-2 cursor-pointer">
					<span className="text-xs text-base-content/50">Advanced</span>
					<input
						type="checkbox"
						className="toggle toggle-sm"
						checked={showAdvancedSettings}
						onChange={(e) => setShowAdvancedSettings(e.target.checked)}
					/>
				</label>
			</div>

			{/* ── General ────────────────────────────────────── */}
			<SettingSectionHeader title="General" />

			<SettingRow
				label="Backend Type"
				description="Wallpaper backend to use for setting wallpapers"
				error={fieldError("type")}
			>
				<select
					className={cn(
						"select select-bordered select-sm w-44",
						fieldError("type") && "select-error",
					)}
					value={(backendType as string) ?? "swww"}
					onChange={(e) => handleChange("type", e.target.value)}
				>
					<option value="swww">swww (Wayland)</option>
					<option value="feh">feh (X11)</option>
					<option value="nitrogen">nitrogen (X11)</option>
					<option value="custom">Custom Script</option>
				</select>
			</SettingRow>

			{/* ── swww settings ───────────────────────────────── */}
			{backendType === "swww" && (
				<>
					<SettingSectionHeader title="swww Transitions" />
					{swwwFields.map(renderField)}
				</>
			)}

			{/* ── Info banners for other backends ─────────────── */}
			{backendType === "feh" && (
				<div className="mt-4 rounded-lg bg-info/10 px-4 py-3 text-sm text-info">
					feh backend selected. Additional feh-specific settings will be
					available in a future update.
				</div>
			)}
			{backendType === "nitrogen" && (
				<div className="mt-4 rounded-lg bg-info/10 px-4 py-3 text-sm text-info">
					nitrogen backend selected. Additional nitrogen-specific settings will
					be available in a future update.
				</div>
			)}
			{backendType === "custom" && (
				<div className="mt-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
					Custom backend selected. You'll need to configure custom scripts
					manually.
				</div>
			)}
		</div>
	);
};

export default BackendSettingsSection;
