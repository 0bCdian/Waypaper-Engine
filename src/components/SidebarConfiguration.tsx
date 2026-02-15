import React, { useState } from "react";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";
import { useSidebarState } from "../hooks/useSidebarState";
import { cn } from "../utils/cn";

/**
 * Sidebar Configuration Component
 */
export const SidebarConfiguration: React.FC = () => {
	const { config } = useUnifiedConfigStore();
	const [activeSection, setActiveSection] = useState<"app" | "swww" | "daemon">(
		"app",
	);

	// Don't render if config is not loaded
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
			{/* Header */}
			<div className="mb-6">
				<h2 className="text-lg font-semibold text-base-content mb-2">
					Settings
				</h2>
				<p className="text-sm text-base-content/70">
					Configure your Waypaper Engine
				</p>
			</div>

			{/* Section Tabs */}
			<div className="flex flex-col gap-2 mb-6">
				{sections.map((section) => (
					<button
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

			{/* Configuration Content */}
			<div className="flex-1 overflow-y-auto">
				{activeSection === "app" && <AppSettings />}
				{activeSection === "swww" && <SwwwSettings />}
				{activeSection === "daemon" && <DaemonSettings />}
			</div>
		</div>
	);
};

/**
 * App Settings Component
 */
const AppSettings: React.FC = () => {
	const { config, setConfigValue } = useUnifiedConfigStore();
	const { isCollapsed: sidebarCollapsed, setCollapsed } = useSidebarState();

	return (
		<div className="space-y-4">
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">
						Sidebar Collapsed
					</span>
				</label>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={sidebarCollapsed}
					onChange={(e) => setCollapsed(e.target.checked)}
				/>
			</div>

			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">Auto Start</span>
				</label>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.start_minimized || false}
					onChange={(e) =>
						setConfigValue("app", "start_minimized", e.target.checked)
					}
				/>
			</div>

			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">
						Minimize to Tray
					</span>
				</label>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.minimize_instead_of_close || false}
					onChange={(e) =>
						setConfigValue("app", "minimize_instead_of_close", e.target.checked)
					}
				/>
			</div>

			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">
						Start Minimized
					</span>
				</label>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.app?.start_minimized || false}
					onChange={(e) =>
						setConfigValue("app", "start_minimized", e.target.checked)
					}
				/>
			</div>
		</div>
	);
};

/**
 * Swww Settings Component
 */
const SwwwSettings: React.FC = () => {
	const { config, setConfigValue } = useUnifiedConfigStore();

	return (
		<div className="space-y-4">
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">
						Transition Type
					</span>
				</label>
				<select
					className="select select-primary select-sm w-full"
					value={config?.backend?.swww?.transition_type || "simple"}
					onChange={(e) =>
						setConfigValue("backend", "swww", { ...config?.backend?.swww, transition_type: e.target.value as any })
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
				<label className="label">
					<span className="label-text text-sm font-medium">
						Transition Duration
					</span>
				</label>
				<input
					type="range"
					min="0"
					max="10"
					step="0.1"
					className="range range-primary range-sm"
					value={config?.backend?.swww?.transition_step || 0}
					onChange={(e) =>
					setConfigValue("backend", "swww", { ...config?.backend?.swww, transition_step: parseFloat(e.target.value) })
					}
				/>
				<div className="flex justify-between text-xs text-base-content/60 px-2">
					<span>0s</span>
					<span>{config?.backend?.swww?.transition_step || 0}s</span>
					<span>10s</span>
				</div>
			</div>

			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">Resize Type</span>
				</label>
				<select
					className="select select-primary select-sm w-full"
					value={config?.backend?.swww?.transition_pos || "center"}
					onChange={(e) =>
						setConfigValue("backend", "swww", { ...config?.backend?.swww, transition_pos: e.target.value as any })
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

/**
 * Daemon Settings Component
 */
const DaemonSettings: React.FC = () => {
	const { config, setConfigValue } = useUnifiedConfigStore();

	return (
		<div className="space-y-4">
			{/* Port configuration - not available in current DaemonConfig */}
			{/* 
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">Daemon Port</span>
				</label>
				<input
					type="number"
					className="input input-primary input-sm w-full"
					value={config?.daemon?.port || 8080}
					onChange={(e) =>
						setConfigValue("daemon", "port", parseInt(e.target.value))
					}
				/>
			</div>
			*/}

			{/* Auto start configuration - not available in current DaemonConfig */}
			{/* 
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">
						Auto Start Daemon
					</span>
				</label>
				<input
					type="checkbox"
					className="toggle toggle-primary"
					checked={config?.daemon?.auto_start || false}
					onChange={(e) =>
						setConfigValue("daemon", "auto_start", e.target.checked)
					}
				/>
			</div>
			*/}

			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm font-medium">Log Level</span>
				</label>
				<select
					className="select select-primary select-sm w-full"
					value={config?.daemon?.log_level || "info"}
					onChange={(e) =>
						setConfigValue("daemon", "log_level", e.target.value as any)
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
