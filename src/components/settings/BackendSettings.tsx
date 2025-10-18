/**
 * Backend Settings Component for Waypaper Engine
 *
 * Backend service configurations (swww, feh, etc.).
 * Handles wallpaper engine specific settings.
 */

import React, { useState, useEffect } from "react";
import { cn } from "../../utils/cn";

/**
 * Backend Settings props interface
 */
export interface BackendSettingsProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Swww configuration interface
 */
interface SwwwConfig {
	transition_type?: string;
	transition_step?: number;
	transition_fps?: number;
	transition_angle?: number;
	transition_pos?: string;
	transition_bezier?: string;
	transition_duration?: number;
	transition_wave?: boolean;
	transition_wipe?: boolean;
	transition_grow?: boolean;
	transition_invert_y?: boolean;
	transition_invert_x?: boolean;
	transition_flip?: boolean;
}

/**
 * Backend Settings component
 */
export const BackendSettings: React.FC<BackendSettingsProps> = ({
	className,
}) => {
	const [config, setConfig] = useState<SwwwConfig>({});
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

			// Get swww config from daemon
			const swwwConfig = await window.API_RENDERER.goDaemon.getSwwwConfig();
			setConfig(swwwConfig || {});
		} catch (err) {
			console.error("Failed to load swww config:", err);
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

			await window.API_RENDERER.goDaemon.setSwwwConfig({ [key]: value });

			// Update local state
			setConfig((prev) => ({ ...prev, [key]: value }));
		} catch (err) {
			console.error("Failed to save swww config:", err);
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

			{/* Swww Configuration Section */}
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
						Swww Configuration
					</h2>
					<p className="text-base-content/70">
						Configure the swww wallpaper engine settings for smooth transitions
						and effects.
					</p>

					<div className="space-y-6 mt-4">
						{/* Transition Type */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Transition type</span>
							</label>
							<select
								className="select select-bordered w-full max-w-xs"
								value={config.transition_type || "simple"}
								onChange={(e) => saveConfig("transition_type", e.target.value)}
								disabled={saving}
							>
								<option value="simple">Simple</option>
								<option value="wipe">Wipe</option>
								<option value="grow">Grow</option>
								<option value="wave">Wave</option>
								<option value="outer">Outer</option>
							</select>
							<div className="label">
								<span className="label-text-alt">
									Type of transition effect when changing wallpapers
								</span>
							</div>
						</div>

						{/* Transition Duration */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">
									Transition duration (ms)
								</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.transition_duration || 300}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										transition_duration: parseInt(e.target.value),
									}))
								}
								min="0"
								max="5000"
								step="50"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Duration of the transition effect in milliseconds
								</span>
							</div>
						</div>

						{/* Transition FPS */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Transition FPS</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.transition_fps || 60}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										transition_fps: parseInt(e.target.value),
									}))
								}
								min="1"
								max="120"
								step="1"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Frames per second for the transition animation
								</span>
							</div>
						</div>

						{/* Transition Angle */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Transition angle</span>
							</label>
							<input
								type="range"
								className="range range-primary"
								min="0"
								max="360"
								value={config.transition_angle || 0}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										transition_angle: parseInt(e.target.value),
									}))
								}
								disabled={saving}
							/>
							<div className="flex justify-between text-xs text-base-content/70 px-2">
								<span>0°</span>
								<span>{config.transition_angle || 0}°</span>
								<span>360°</span>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Angle for directional transitions (wipe, grow)
								</span>
							</div>
						</div>

						{/* Transition Position */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Transition position</span>
							</label>
							<select
								className="select select-bordered w-full max-w-xs"
								value={config.transition_pos || "center"}
								onChange={(e) => saveConfig("transition_pos", e.target.value)}
								disabled={saving}
							>
								<option value="center">Center</option>
								<option value="top">Top</option>
								<option value="bottom">Bottom</option>
								<option value="left">Left</option>
								<option value="right">Right</option>
								<option value="top-left">Top Left</option>
								<option value="top-right">Top Right</option>
								<option value="bottom-left">Bottom Left</option>
								<option value="bottom-right">Bottom Right</option>
							</select>
							<div className="label">
								<span className="label-text-alt">
									Starting position for transitions
								</span>
							</div>
						</div>

						{/* Transition Effects */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold">Transition Effects</h3>

							<div className="grid grid-cols-2 gap-4">
								{/* Wave Effect */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Wave effect</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_wave || false}
											onChange={(e) =>
												saveConfig("transition_wave", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>

								{/* Wipe Effect */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Wipe effect</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_wipe || false}
											onChange={(e) =>
												saveConfig("transition_wipe", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>

								{/* Grow Effect */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Grow effect</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_grow || false}
											onChange={(e) =>
												saveConfig("transition_grow", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>

								{/* Invert Y */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Invert Y</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_invert_y || false}
											onChange={(e) =>
												saveConfig("transition_invert_y", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>

								{/* Invert X */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Invert X</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_invert_x || false}
											onChange={(e) =>
												saveConfig("transition_invert_x", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>

								{/* Flip */}
								<div className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Flip</span>
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={config.transition_flip || false}
											onChange={(e) =>
												saveConfig("transition_flip", e.target.checked)
											}
											disabled={saving}
										/>
									</label>
								</div>
							</div>
						</div>

						{/* Bezier Curve */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Bezier curve</span>
							</label>
							<input
								type="text"
								className="input input-bordered w-full max-w-xs"
								value={config.transition_bezier || "0,0,0,0"}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										transition_bezier: e.target.value,
									}))
								}
								placeholder="0,0,0,0"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Custom bezier curve for smooth transitions (x1,y1,x2,y2)
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

export default BackendSettings;
