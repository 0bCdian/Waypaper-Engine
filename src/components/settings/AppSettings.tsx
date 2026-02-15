/**
 * App Settings Component for Waypaper Engine
 *
 * Electron application-specific settings.
 * Handles window behavior, theme, and app preferences.
 */

import React, { useState, useEffect } from "react";
import { cn } from "../../utils/cn";
import type { UnifiedConfig } from "../../../shared/types/unifiedConfig";

/**
 * App Settings props interface
 */
export interface AppSettingsProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * App configuration interface
 */
interface AppConfig {
	theme?: string;
	auto_start?: boolean;
	minimize_to_tray?: boolean;
	close_to_tray?: boolean;
}

/**
 * App Settings component
 */
export const AppSettings: React.FC<AppSettingsProps> = ({ className }) => {
	const [config, setConfig] = useState<AppConfig>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load configuration on mount
	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get app config from daemon
			const unifiedConfig = await window.API_RENDERER.goDaemon.getConfig();
			// Convert unified config to local format
			setConfig({
				theme: unifiedConfig.app.theme,
			});
		} catch (err) {
			console.error("Failed to load app config:", err);
			setError(
				err instanceof Error ? err.message : "Failed to load configuration",
			);
		} finally {
			setLoading(false);
		}
	};

	const saveConfig = async (key: string, value: unknown) => {
		try {
			setSaving(true);
			setError(null);

			// Use setBulkConfig for app settings
			await window.API_RENDERER.goDaemon.setBulkConfig({
				app: {
					[key]: value,
				} as Partial<UnifiedConfig["app"]>,
			});

			// Update local state
			setConfig((prev) => ({ ...prev, [key]: value }));
		} catch (err) {
			console.error("Failed to save app config:", err);
			setError(
				err instanceof Error ? err.message : "Failed to save configuration",
			);
		} finally {
			setSaving(false);
		}
	};

	const containerClasses = cn("p-6 space-y-6", className);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	return (
		<div className={containerClasses}>
			{/* Error Alert */}
			{error && (
				<div className="alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
					<button
						className="btn btn-sm btn-outline"
						onClick={() => setError(null)}
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Window Behavior Section */}
			<div className="card bg-base-200">
				<div className="card-body">
					<h2 className="card-title text-xl">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<path d="M9 9h6v6H9z" />
						</svg>
						Window Behavior
					</h2>

					<div className="space-y-4">
						{/* Auto Start */}
						<div className="form-control">
							<label className="label cursor-pointer">
								<span className="label-text text-lg">Start with system</span>
								<input
									type="checkbox"
									className="toggle toggle-primary"
									checked={config.auto_start || false}
									onChange={(e) => saveConfig("auto_start", e.target.checked)}
									disabled={saving}
								/>
							</label>
							<div className="label">
								<span className="label-text-alt">
									Automatically start Waypaper Engine when the system boots
								</span>
							</div>
						</div>

						{/* Minimize to Tray */}
						<div className="form-control">
							<label className="label cursor-pointer">
								<span className="label-text text-lg">
									Minimize to system tray
								</span>
								<input
									type="checkbox"
									className="toggle toggle-primary"
									checked={config.minimize_to_tray || false}
									onChange={(e) =>
										saveConfig("minimize_to_tray", e.target.checked)
									}
									disabled={saving}
								/>
							</label>
							<div className="label">
								<span className="label-text-alt">
									Minimize the window to the system tray instead of the taskbar
								</span>
							</div>
						</div>

						{/* Close to Tray */}
						<div className="form-control">
							<label className="label cursor-pointer">
								<span className="label-text text-lg">Close to system tray</span>
								<input
									type="checkbox"
									className="toggle toggle-primary"
									checked={config.close_to_tray || false}
									onChange={(e) =>
										saveConfig("close_to_tray", e.target.checked)
									}
									disabled={saving}
								/>
							</label>
							<div className="label">
								<span className="label-text-alt">
									Keep the application running in the system tray when closed
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Interface Section */}
			<div className="card bg-base-200">
				<div className="card-body">
					<h2 className="card-title text-xl">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
						Interface
					</h2>

					<div className="space-y-4">
						{/* Theme Selection */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Default theme</span>
							</label>
							<select
								className="select select-bordered w-full max-w-xs"
								value={config.theme || "system"}
								onChange={(e) => saveConfig("theme", e.target.value)}
								disabled={saving}
							>
								<option value="system">System</option>
								<option value="light">Light</option>
								<option value="dark">Dark</option>
								<option value="lofi">Lofi</option>
								<option value="cupcake">Cupcake</option>
								<option value="synthwave">Synthwave</option>
							</select>
							<div className="label">
								<span className="label-text-alt">
									Choose the default theme for the application
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Actions */}
			<div className="flex justify-end gap-2">
				<button
					className="btn btn-outline"
					onClick={loadConfig}
					disabled={loading || saving}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
						<path d="M21 3v5h-5" />
						<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
						<path d="M3 21v-5h5" />
					</svg>
					Reset
				</button>
			</div>
		</div>
	);
};

export default AppSettings;
