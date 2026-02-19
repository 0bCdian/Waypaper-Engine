import type React from "react";
import { useCallback, useState } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDesignSystemStore } from "@/stores/designSystemStore";
import { useShallow } from "zustand/react/shallow";
import InlineThemeSelector from "../InlineThemeSelector";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

interface AppSettingsSectionProps {
	className?: string;
}

interface BoolField {
	key: string;
	label: string;
	description: string;
}

const behaviorFields: BoolField[] = [
	{
		key: "kill_daemon_on_exit",
		label: "Kill Daemon on Exit",
		description:
			"Terminate the background daemon when the application closes",
	},
	{
		key: "notifications",
		label: "Notifications",
		description: "Enable desktop notifications for wallpaper changes",
	},
	{
		key: "start_minimized",
		label: "Start Minimized",
		description: "Start the application minimized to system tray",
	},
	{
		key: "minimize_instead_of_close",
		label: "Minimize Instead of Close",
		description: "Minimize to tray instead of closing the application",
	},
	{
		key: "show_monitor_modal_on_start",
		label: "Show Monitor Modal on Start",
		description:
			"Show monitor selection modal when starting the application",
	},
];

export const AppSettingsSection: React.FC<AppSettingsSectionProps> = ({
	className = "",
}) => {
	const { config, saveConfigSection, errors } = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
			errors: s.errors,
		})),
	);
	const section: ConfigSection = "app";

	const [themeOpen, setThemeOpen] = useState(false);

	const handleChange = async (key: string, value: unknown) => {
		await saveConfigSection(section, { [key]: value });
	};

	const fieldError = (key: string) =>
		errors.find((e) => e.section === section && e.key === key)?.message;

	return (
		<div className={cn("space-y-0", className)}>
			{/* ── Section title ──────────────────────────────── */}
			<h2 className="text-lg font-semibold text-base-content mb-1">General</h2>
			<p className="text-sm text-base-content/50 mb-4">
				Application behavior, appearance, and UI preferences.
			</p>

			{/* ── Theme & Appearance ─────────────────────────── */}
			<SettingSectionHeader title="Theme & Appearance" />

			<button
				type="button"
				className="w-full flex items-center justify-between py-4 border-b border-base-content/5 group"
				onClick={() => setThemeOpen((v) => !v)}
			>
				<div className="text-left">
					<div className="text-sm font-medium text-base-content">
						Application Theme
					</div>
					<div className="text-xs text-base-content/50 mt-0.5">
						Choose the visual theme for the application interface
					</div>
				</div>
				<svg
					className={cn(
						"w-4 h-4 text-base-content/40 transition-transform",
						themeOpen && "rotate-180",
					)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{themeOpen && (
				<div className="py-4 border-b border-base-content/5">
					<InlineThemeSelector
						onThemeChange={(themeName) => handleChange("theme", themeName)}
						showDescriptions={true}
					/>
				</div>
			)}

			{/* ── Design System ───────────────────────────────── */}
			<DesignSystemSection />

			{/* ── Behavior ────────────────────────────────────── */}
			<SettingSectionHeader title="Behavior" />

			{behaviorFields.map((f) => (
				<SettingRow
					key={f.key}
					label={f.label}
					description={f.description}
					error={fieldError(f.key)}
				>
					<input
						type="checkbox"
						className="toggle toggle-primary"
						checked={Boolean(
							config?.app?.[f.key as keyof typeof config.app],
						)}
						onChange={(e) => handleChange(f.key, e.target.checked)}
					/>
				</SettingRow>
			))}

			{/* ── Import ─────────────────────────────────────── */}
			<SettingSectionHeader title="Import" />
			<UrlImportWarningSetting />
		</div>
	);
};

/* ── Design System Settings ──────────────────────────────────── */

const DesignSystemSection: React.FC = () => {
	const { designMode, neoConfig, setDesignMode, updateNeoConfig } =
		useDesignSystemStore(
			useShallow((s) => ({
				designMode: s.designMode,
				neoConfig: s.neoConfig,
				setDesignMode: s.setDesignMode,
				updateNeoConfig: s.updateNeoConfig,
			})),
		);

	const isNeo = designMode === "neobrutalist";

	return (
		<>
			<SettingSectionHeader title="Design System" />

			<SettingRow
				label="Neobrutalist Mode"
				description="Thick borders, hard shadows, bold typography on all UI elements"
			>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={isNeo}
					onChange={(e) =>
						setDesignMode(e.target.checked ? "neobrutalist" : "default")
					}
				/>
			</SettingRow>

			{isNeo && (
				<>
					<SettingRow
						label="Polaroid Image Cards"
						description="Display wallpaper thumbnails as polaroid-style frames"
					>
						<input
							type="checkbox"
							className="toggle toggle-secondary"
							checked={neoConfig.polaroidCards}
							onChange={(e) =>
								updateNeoConfig({ polaroidCards: e.target.checked })
							}
						/>
					</SettingRow>

					<SettingRow
						label="Shadow Offset"
						description="Hard shadow distance behind elements"
					>
						<div className="flex items-center gap-3">
							<input
								type="range"
								min={1}
								max={6}
								step={1}
								className="range range-primary range-sm w-28"
								value={neoConfig.shadowOffsetX}
								onChange={(e) => {
									const v = Number(e.target.value);
									updateNeoConfig({ shadowOffsetX: v, shadowOffsetY: v });
								}}
							/>
							<span className="text-xs text-base-content/50 w-8 text-right">
								{neoConfig.shadowOffsetX}px
							</span>
						</div>
					</SettingRow>

					<SettingRow
						label="Border Width"
						description="Thickness of element borders"
					>
						<div className="flex items-center gap-3">
							<input
								type="range"
								min={1}
								max={4}
								step={1}
								className="range range-primary range-sm w-28"
								value={neoConfig.borderWidth}
								onChange={(e) =>
									updateNeoConfig({ borderWidth: Number(e.target.value) })
								}
							/>
							<span className="text-xs text-base-content/50 w-8 text-right">
								{neoConfig.borderWidth}px
							</span>
						</div>
					</SettingRow>

					<SettingRow
						label="Corner Radius"
						description="0 for sharp corners, higher for rounded"
					>
						<div className="flex items-center gap-3">
							<input
								type="range"
								min={0}
								max={1}
								step={0.125}
								className="range range-primary range-sm w-28"
								value={neoConfig.cornerRadius}
								onChange={(e) =>
									updateNeoConfig({
										cornerRadius: Number(e.target.value),
									})
								}
							/>
							<span className="text-xs text-base-content/50 w-12 text-right">
								{neoConfig.cornerRadius}rem
							</span>
						</div>
					</SettingRow>
				</>
			)}
		</>
	);
};

/* ── URL Import Warning Setting (localStorage-backed) ─────────── */

const UrlImportWarningSetting: React.FC = () => {
	const [skip, setSkip] = useState(
		() => localStorage.getItem("skipUrlImportWarning") === "true",
	);

	const toggle = useCallback((checked: boolean) => {
		setSkip(checked);
		if (checked) {
			localStorage.setItem("skipUrlImportWarning", "true");
		} else {
			localStorage.removeItem("skipUrlImportWarning");
		}
	}, []);

	return (
		<SettingRow
			label="Skip URL Import Warning"
			description="When enabled, images dragged from the browser are imported without a safety prompt"
		>
			<input
				type="checkbox"
				className="toggle toggle-primary"
				checked={skip}
				onChange={(e) => toggle(e.target.checked)}
			/>
		</SettingRow>
	);
};

export default AppSettingsSection;
