import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
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

const swwwDisplayFields: Field[] = [
	{
		key: "swww.resize",
		label: "Resize Mode",
		description: "How the image is fitted to the monitor",
		type: "select",
		options: [
			{ value: "crop", label: "Crop (cover, preserve aspect ratio)" },
			{ value: "fit", label: "Fit (contain, letterbox)" },
			{ value: "no", label: "No Resize (native resolution)" },
			{ value: "stretch", label: "Stretch (fill, ignore aspect ratio)" },
		],
	},
	{
		key: "swww.fill_color",
		label: "Fill Color",
		description: 'Color for empty space when resize is "Fit" (hex without #)',
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
];

const swwwTransitionFields: Field[] = [
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
		key: "swww.invert_y",
		label: "Invert Y",
		description: "Invert the y-axis for transition animations",
		type: "checkbox",
	},
];

const fehDisplayFields: Field[] = [
	{
		key: "feh.mode",
		label: "Display Mode",
		description: "How the image is fitted to the screen",
		type: "select",
		options: [
			{ value: "fill", label: "Fill (cover + crop)" },
			{ value: "scale", label: "Scale (fit, letterbox)" },
			{ value: "tile", label: "Tile (repeat)" },
			{ value: "center", label: "Center (no scaling)" },
			{ value: "max", label: "Max (fit + fill remainder)" },
		],
	},
];

const hyprpaperDisplayFields: Field[] = [
	{
		key: "hyprpaper.fit_mode",
		label: "Fit Mode",
		description: "How hyprpaper scales the wallpaper image",
		type: "select",
		options: [
			{ value: "cover", label: "Cover" },
			{ value: "contain", label: "Contain" },
			{ value: "tile", label: "Tile" },
			{ value: "fill", label: "Fill" },
		],
	},
];

const hyprpaperAdvancedFields: Field[] = [
	{
		key: "hyprpaper.use_ipc",
		label: "Use IPC Mode",
		description:
			"Use hyprctl IPC instead of config-file restart (requires hyprpaper > 0.8.3)",
		type: "checkbox",
	},
	{
		key: "hyprpaper.config_path",
		label: "Config Path Override",
		description:
			"Custom path for hyprpaper.conf (leave empty for default ~/.config/hypr/hyprpaper.conf)",
		type: "text",
		placeholder: "~/.config/hypr/hyprpaper.conf",
	},
];

function DebouncedNumberInput({
	value: externalValue,
	onCommit,
	className,
	min,
	max,
	step,
}: {
	value: number;
	onCommit: (v: number) => void;
	className?: string;
	min?: number;
	max?: number;
	step?: number;
}) {
	const [local, setLocal] = useState(String(externalValue));
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		setLocal(String(externalValue));
	}, [externalValue]);

	const commit = useCallback(
		(raw: string) => {
			clearTimeout(timerRef.current);
			const n = Number.parseInt(raw, 10);
			if (!Number.isNaN(n)) onCommit(n);
		},
		[onCommit],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value;
		setLocal(v);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => commit(v), 600);
	};

	return (
		<input
			type="number"
			className={className}
			value={local}
			onChange={handleChange}
			onBlur={() => commit(local)}
			min={min}
			max={max}
			step={step}
		/>
	);
}

function DebouncedTextInput({
	value: externalValue,
	onCommit,
	className,
	placeholder,
}: {
	value: string;
	onCommit: (v: string) => void;
	className?: string;
	placeholder?: string;
}) {
	const [local, setLocal] = useState(externalValue);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		setLocal(externalValue);
	}, [externalValue]);

	const commit = useCallback(
		(v: string) => {
			clearTimeout(timerRef.current);
			onCommit(v);
		},
		[onCommit],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value;
		setLocal(v);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => commit(v), 600);
	};

	return (
		<input
			type="text"
			className={className}
			value={local}
			onChange={handleChange}
			onBlur={() => commit(local)}
			placeholder={placeholder}
		/>
	);
}

interface AvailableBackend {
	name: string;
	available: boolean;
}

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

	const [availableBackends, setAvailableBackends] = useState<AvailableBackend[]>([]);

	useEffect(() => {
		window.API_RENDERER?.goDaemon?.getBackends?.()
			.then((backends) => {
				setAvailableBackends(
					backends.map((b) => ({ name: b.name, available: b.available })),
				);
			})
			.catch(() => {});
	}, []);

	const handleChange = async (key: string, value: unknown) => {
		if (key.startsWith("swww.")) {
			const swwwKey = key.replace("swww.", "");
			await saveConfigSection(section, { [swwwKey]: value });
		} else if (key.startsWith("feh.")) {
			const fehKey = key.replace("feh.", "");
			await saveConfigSection(section, { [fehKey]: value });
		} else if (key.startsWith("hyprpaper.")) {
			const hpKey = key.replace("hyprpaper.", "");
			await saveConfigSection(section, { [hpKey]: value });
		} else {
			await saveConfigSection(section, { [key]: value });
		}
	};

	const fieldError = (key: string) =>
		errors.find((e) => e.section === section && e.key === key)?.message;

	const renderField = (field: Field) => {
		let raw: unknown;
		if (field.key.startsWith("swww.")) {
			raw = config?.backend?.swww?.[
				field.key.replace("swww.", "") as keyof NonNullable<typeof config.backend.swww>
			];
		} else if (field.key.startsWith("feh.")) {
			raw = config?.backend?.feh?.[
				field.key.replace("feh.", "") as keyof NonNullable<typeof config.backend.feh>
			];
		} else if (field.key.startsWith("hyprpaper.")) {
			raw = config?.backend?.hyprpaper?.[
				field.key.replace("hyprpaper.", "") as keyof NonNullable<typeof config.backend.hyprpaper>
			];
		} else {
			raw = config?.backend?.[field.key as keyof typeof config.backend];
		}

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
							"select select-bordered select-sm w-full lg:w-44",
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
					<DebouncedNumberInput
						className={cn(
							"input input-bordered input-sm w-full lg:w-28",
							fieldError(field.key) && "input-error",
						)}
						value={(raw as number) ?? 0}
						onCommit={(v) => handleChange(field.key, v)}
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
				<DebouncedTextInput
					className={cn(
						"input input-bordered input-sm w-full lg:w-48",
						fieldError(field.key) && "input-error",
					)}
					value={(raw as string) ?? ""}
					onCommit={(v) => handleChange(field.key, v)}
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
					{availableBackends.length > 0
						? availableBackends.map((b) => (
								<option key={b.name} value={b.name} disabled={!b.available}>
									{b.name}{!b.available ? " (not installed)" : ""}
								</option>
							))
						: <option value={backendType ?? "swww"}>{backendType ?? "swww"}</option>
					}
				</select>
			</SettingRow>

			{/* ── swww settings ───────────────────────────────── */}
			{backendType === "swww" && (
				<>
					<SettingSectionHeader title="Image Display" />
					{swwwDisplayFields.map(renderField)}
					<SettingSectionHeader title="Transitions" />
					{swwwTransitionFields.map(renderField)}
				</>
			)}

			{/* ── feh settings ──────────────────────────────────── */}
			{backendType === "feh" && (
				<>
					<SettingSectionHeader title="Image Display" />
					{fehDisplayFields.map(renderField)}
				</>
			)}

			{/* ── hyprpaper settings ─────────────────────────────── */}
			{backendType === "hyprpaper" && (
				<>
					<SettingSectionHeader title="Image Display" />
					{hyprpaperDisplayFields.map(renderField)}
					{showAdvancedSettings && (
						<>
							<SettingSectionHeader title="Advanced" />
							{hyprpaperAdvancedFields.map(renderField)}
						</>
					)}
				</>
			)}
		</div>
	);
};

export default BackendSettingsSection;
