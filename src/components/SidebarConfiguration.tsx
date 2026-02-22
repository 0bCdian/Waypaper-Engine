import type React from "react";
import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils/cn";

/**
 * Sidebar Configuration Component
 */
export const SidebarConfiguration: React.FC = () => {
	const config = useSettingsStore((s) => s.config);
	const [activeSection, setActiveSection] = useState<"app" | "swww" | "daemon">(
		"app",
	);

	if (!config) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="loading loading-spinner loading-md"></div>
			</div>
		);
	}

	const sections = [
		{ id: "app", label: "App Settings", icon: "⚙️" },
		{ id: "swww", label: "Swww Config", icon: "🖼️" },
		{ id: "daemon", label: "Daemon", icon: "🔧" },
	] as const;

	return (
		<div className="flex flex-col">
			<div className="mb-6">
				<h2 className="text-lg font-semibold text-base-content mb-2">
					Settings
				</h2>
				<p className="text-sm text-base-content/70">
					Configure your Waypaper Engine
				</p>
			</div>

			<div className="flex flex-col gap-2 mb-6">
				{sections.map((section) => (
					<button
						type="button"
						key={section.id}
						onClick={() => setActiveSection(section.id)}
						className={cn(
							"btn btn-sm justify-start w-full",
							activeSection === section.id ? "btn-primary" : "btn-ghost",
						)}
					>
						<span className="mr-2">{section.icon}</span>
						{section.label}
					</button>
				))}
			</div>

			<div className="flex-1 overflow-y-auto">
				{activeSection === "app" && <AppSettings />}
				{activeSection === "swww" && <SwwwSettings />}
				{activeSection === "daemon" && <DaemonSettings />}
			</div>
		</div>
	);
};

const AppSettings: React.FC = () => {
	const { config, saveConfigSection } = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
		})),
	);

	return (
		<div className="space-y-4">
			<div className="form-control">
			<label htmlFor="app-start-minimized" className="label">
					<span className="label-text text-sm font-medium">
						Start Minimized
					</span>
				</label>
				<input
					id="app-start-minimized"
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.start_minimized || false}
					onChange={(e) =>
						saveConfigSection("app", { start_minimized: e.target.checked })
					}
				/>
			</div>

			<div className="form-control">
				<label htmlFor="app-minimize-to-tray" className="label">
					<span className="label-text text-sm font-medium">
						Minimize to Tray
					</span>
				</label>
				<input
					id="app-minimize-to-tray"
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.minimize_instead_of_close || false}
					onChange={(e) =>
						saveConfigSection("app", {
							minimize_instead_of_close: e.target.checked,
						})
					}
				/>
			</div>

			<div className="form-control">
				<label htmlFor="app-kill-daemon-on-exit" className="label">
					<span className="label-text text-sm font-medium">
						Kill Daemon on Exit
					</span>
				</label>
				<input
					id="app-kill-daemon-on-exit"
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.kill_daemon_on_exit || false}
					onChange={(e) =>
						saveConfigSection("app", { kill_daemon_on_exit: e.target.checked })
					}
				/>
			</div>
		</div>
	);
};

const SwwwSettings: React.FC = () => {
	const { config, saveConfigSection } = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
		})),
	);

	return (
		<div className="space-y-4">
			<div className="form-control">
				<label htmlFor="swww-transition-type" className="label">
					<span className="label-text text-sm font-medium">
						Transition Type
					</span>
				</label>
				<select
					id="swww-transition-type"
					className="select select-primary select-sm w-full"
					value={config?.backend?.swww?.transition_type || "simple"}
					onChange={(e) =>
						saveConfigSection("backend", { transition_type: e.target.value })
					}
				>
					<option value="simple">Simple</option>
					<option value="fade">Fade</option>
					<option value="wipe">Wipe</option>
					<option value="outer">Outer</option>
					<option value="grow">Grow</option>
					<option value="wave">Wave</option>
					<option value="pixelate">Pixelate</option>
				</select>
			</div>

			<div className="form-control">
				<label htmlFor="swww-transition-step" className="label">
					<span className="label-text text-sm font-medium">
						Transition Step
					</span>
				</label>
				<input
					id="swww-transition-step"
					type="range"
					min="0"
					max="255"
					step="1"
					className="range range-primary range-sm"
					value={config?.backend?.swww?.transition_step || 0}
					onChange={(e) =>
						saveConfigSection("backend", {
							transition_step: parseInt(e.target.value, 10),
						})
					}
				/>
				<div className="flex justify-between text-xs text-base-content/60 px-2">
					<span>0</span>
					<span>{config?.backend?.swww?.transition_step || 0}</span>
					<span>255</span>
				</div>
			</div>

			<div className="form-control">
				<label htmlFor="swww-resize-type" className="label">
					<span className="label-text text-sm font-medium">Resize Type</span>
				</label>
				<select
					id="swww-resize-type"
					className="select select-primary select-sm w-full"
					value={config?.backend?.swww?.resize || "crop"}
					onChange={(e) =>
						saveConfigSection("backend", { resize: e.target.value })
					}
				>
					<option value="crop">Crop</option>
					<option value="fit">Fit</option>
					<option value="no">No Resize</option>
				</select>
			</div>
		</div>
	);
};

const DaemonSettings: React.FC = () => {
	const { config, saveConfigSection } = useSettingsStore(
		useShallow((s) => ({
			config: s.config,
			saveConfigSection: s.saveConfigSection,
		})),
	);

	return (
		<div className="space-y-4">
			<div className="form-control">
				<label htmlFor="daemon-log-level" className="label">
					<span className="label-text text-sm font-medium">Log Level</span>
				</label>
				<select
					id="daemon-log-level"
					className="select select-primary select-sm w-full"
					value={config?.daemon?.log_level || "info"}
					onChange={(e) =>
						saveConfigSection("daemon", { log_level: e.target.value })
					}
				>
					<option value="debug">Debug</option>
					<option value="info">Info</option>
					<option value="warn">Warning</option>
					<option value="error">Error</option>
				</select>
			</div>
		</div>
	);
};

export default SidebarConfiguration;
