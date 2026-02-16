/**
 * Global Settings Component for Waypaper Engine
 *
 * Shared configuration settings that apply to both frontend and backend.
 * Handles paths, log levels, and global preferences.
 */

import React, { useState, useEffect } from "react";
import { cn } from "../../utils/cn";

/**
 * Global Settings props interface
 */
export interface GlobalSettingsProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Global configuration interface
 */
interface GlobalConfig {
	log_level?: string;
	data_dir?: string;
	cache_dir?: string;
	temp_dir?: string;
	max_concurrent_processing?: number;
	thumbnail_size?: number;
	image_quality?: number;
	auto_refresh_interval?: number;
}

/**
 * Global Settings component
 */
export const GlobalSettings: React.FC<GlobalSettingsProps> = ({
	className,
}) => {
	const [config, setConfig] = useState<GlobalConfig>({});
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

			// Get global config from daemon
			const globalConfig = await window.API_RENDERER.goDaemon.getConfig();
			setConfig(globalConfig?.daemon || {});
		} catch (err) {
			console.error("Failed to load global config:", err);
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

			await window.API_RENDERER.goDaemon.updateConfigSection("daemon", { [key]: value });

			// Update local state
			setConfig((prev) => ({ ...prev, [key]: value }));
		} catch (err) {
			console.error("Failed to save global config:", err);
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

			{/* Paths Section */}
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
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14,2 14,8 20,8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
							<polyline points="10,9 9,9 8,9" />
						</svg>
						Paths
					</h2>

					<div className="space-y-4">
						{/* Data Directory */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Data directory</span>
							</label>
							<div className="join w-full">
								<input
									type="text"
									className="input input-bordered join-item flex-1"
									value={config.data_dir || ""}
									onChange={(e) =>
										setConfig((prev) => ({ ...prev, data_dir: e.target.value }))
									}
									placeholder="/home/user/.local/share/waypaper-engine"
									disabled={saving}
								/>
								<button
									className="btn btn-outline join-item"
									onClick={() => saveConfig("data_dir", config.data_dir)}
									disabled={saving}
								>
									Save
								</button>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Directory where application data is stored
								</span>
							</div>
						</div>

						{/* Cache Directory */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Cache directory</span>
							</label>
							<div className="join w-full">
								<input
									type="text"
									className="input input-bordered join-item flex-1"
									value={config.cache_dir || ""}
									onChange={(e) =>
										setConfig((prev) => ({
											...prev,
											cache_dir: e.target.value,
										}))
									}
									placeholder="/home/user/.cache/waypaper-engine"
									disabled={saving}
								/>
								<button
									className="btn btn-outline join-item"
									onClick={() => saveConfig("cache_dir", config.cache_dir)}
									disabled={saving}
								>
									Save
								</button>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Directory for temporary files and cache
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Performance Section */}
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
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
						</svg>
						Performance
					</h2>

					<div className="space-y-4">
						{/* Max Concurrent Processing */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">
									Max concurrent processing
								</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.max_concurrent_processing || 4}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										max_concurrent_processing: parseInt(e.target.value),
									}))
								}
								min="1"
								max="16"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Maximum number of images to process simultaneously
								</span>
							</div>
						</div>

						{/* Thumbnail Size */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Thumbnail size (px)</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.thumbnail_size || 256}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										thumbnail_size: parseInt(e.target.value),
									}))
								}
								min="64"
								max="512"
								step="32"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Size of generated thumbnails in pixels
								</span>
							</div>
						</div>

						{/* Image Quality */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Image quality</span>
							</label>
							<input
								type="range"
								className="range range-primary"
								min="1"
								max="100"
								value={config.image_quality || 85}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										image_quality: parseInt(e.target.value),
									}))
								}
								disabled={saving}
							/>
							<div className="flex justify-between text-xs text-base-content/70 px-2">
								<span>1%</span>
								<span>{config.image_quality || 85}%</span>
								<span>100%</span>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Quality for processed images (1-100%)
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Logging Section */}
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
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14,2 14,8 20,8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
							<polyline points="10,9 9,9 8,9" />
						</svg>
						Logging
					</h2>

					<div className="space-y-4">
						{/* Log Level */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Log level</span>
							</label>
							<select
								className="select select-bordered w-full max-w-xs"
								value={config.log_level || "info"}
								onChange={(e) => saveConfig("log_level", e.target.value)}
								disabled={saving}
							>
								<option value="debug">Debug</option>
								<option value="info">Info</option>
								<option value="warn">Warning</option>
								<option value="error">Error</option>
							</select>
							<div className="label">
								<span className="label-text-alt">
									Minimum log level to record
								</span>
							</div>
						</div>

						{/* Auto Refresh Interval */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">
									Auto refresh interval (seconds)
								</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.auto_refresh_interval || 30}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										auto_refresh_interval: parseInt(e.target.value),
									}))
								}
								min="5"
								max="300"
								step="5"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									How often to refresh the gallery automatically
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
				<button
					className="btn btn-primary"
					onClick={() => {
						// Save all current values
						Object.entries(config).forEach(([key, value]) => {
							saveConfig(key, value);
						});
					}}
					disabled={loading || saving}
				>
					{saving ? (
						<>
							<span className="loading loading-spinner loading-sm"></span>
							Saving...
						</>
					) : (
						<>
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
								<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
								<polyline points="17,21 17,13 7,13 7,21" />
								<polyline points="7,3 7,8 15,8" />
							</svg>
							Save All
						</>
					)}
				</button>
			</div>
		</div>
	);
};

export default GlobalSettings;
