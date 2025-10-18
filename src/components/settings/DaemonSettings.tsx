/**
 * Daemon Settings Component for Waypaper Engine
 *
 * Daemon-specific settings and status information.
 * Handles daemon configuration and monitoring.
 */

import React, { useState, useEffect } from "react";
import { cn } from "../../utils/cn";

/**
 * Daemon Settings props interface
 */
export interface DaemonSettingsProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Daemon configuration interface
 */
interface DaemonConfig {
	auto_start?: boolean;
	socket_path?: string;
	log_file?: string;
	pid_file?: string;
	max_connections?: number;
	heartbeat_interval?: number;
	timeout?: number;
}

/**
 * Daemon status interface
 */
interface DaemonStatus {
	running: boolean;
	pid?: number;
	uptime?: number;
	version?: string;
	connections?: number;
}

/**
 * Daemon Settings component
 */
export const DaemonSettings: React.FC<DaemonSettingsProps> = ({
	className,
}) => {
	const [config, setConfig] = useState<DaemonConfig>({});
	const [status, setStatus] = useState<DaemonStatus>({ running: false });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load configuration and status on mount
	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Load daemon config and status in parallel
			const [daemonConfig, daemonStatus] = await Promise.all([
				window.API_RENDERER.goDaemon.getConfig().catch(() => ({})),
				window.API_RENDERER.goDaemon
					.getDaemonStatus()
					.catch(() => ({ running: false })),
			]);

			setConfig(daemonConfig?.daemon || {});
			setStatus(daemonStatus || { running: false });
		} catch (err) {
			console.error("Failed to load daemon data:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to load daemon information",
			);
		} finally {
			setLoading(false);
		}
	};

	const saveConfig = async (key: string, value: unknown) => {
		try {
			setSaving(true);
			setError(null);

			await window.API_RENDERER.goDaemon.setConfig("daemon", key, value);

			// Update local state
			setConfig((prev) => ({ ...prev, [key]: value }));
		} catch (err) {
			console.error("Failed to save daemon config:", err);
			setError(
				err instanceof Error ? err.message : "Failed to save configuration",
			);
		} finally {
			setSaving(false);
		}
	};

	const handleDaemonAction = async (action: "start" | "stop" | "restart") => {
		try {
			setSaving(true);
			setError(null);

			switch (action) {
				case "start":
					// Start daemon logic would go here
					break;
				case "stop":
					await window.API_RENDERER.goDaemon.stopDaemon();
					break;
				case "restart":
					await window.API_RENDERER.goDaemon.stopDaemon();
					// Restart logic would go here
					break;
			}

			// Refresh status after action
			setTimeout(loadData, 1000);
		} catch (err) {
			console.error(`Failed to ${action} daemon:`, err);
			setError(
				err instanceof Error ? err.message : `Failed to ${action} daemon`,
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

			{/* Daemon Status Section */}
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
							<circle cx="12" cy="12" r="3" />
							<path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
						</svg>
						Daemon Status
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Status Badge */}
						<div className="flex items-center gap-3">
							<span className="text-lg font-medium">Status:</span>
							<div
								className={`badge badge-lg ${status.running ? "badge-success" : "badge-error"}`}
							>
								{status.running ? "Running" : "Stopped"}
							</div>
						</div>

						{/* PID */}
						{status.pid && (
							<div className="flex items-center gap-3">
								<span className="text-lg font-medium">PID:</span>
								<span className="font-mono text-lg">{status.pid}</span>
							</div>
						)}

						{/* Version */}
						{status.version && (
							<div className="flex items-center gap-3">
								<span className="text-lg font-medium">Version:</span>
								<span className="font-mono text-lg">{status.version}</span>
							</div>
						)}

						{/* Connections */}
						{status.connections !== undefined && (
							<div className="flex items-center gap-3">
								<span className="text-lg font-medium">Connections:</span>
								<span className="font-mono text-lg">{status.connections}</span>
							</div>
						)}
					</div>

					{/* Daemon Actions */}
					<div className="card-actions justify-end mt-4">
						<button
							className="btn btn-outline"
							onClick={() => handleDaemonAction("restart")}
							disabled={saving}
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
							Restart
						</button>
						<button
							className={`btn ${status.running ? "btn-error" : "btn-success"}`}
							onClick={() =>
								handleDaemonAction(status.running ? "stop" : "start")
							}
							disabled={saving}
						>
							{status.running ? (
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
										<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
										<path d="M9 9h6v6H9z" />
									</svg>
									Stop
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
										<polygon points="5,3 19,12 5,21" />
									</svg>
									Start
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Daemon Configuration Section */}
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
						Daemon Configuration
					</h2>

					<div className="space-y-4">
						{/* Auto Start */}
						<div className="form-control">
							<label className="label cursor-pointer">
								<span className="label-text text-lg">Auto start daemon</span>
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
									Automatically start the daemon when the application launches
								</span>
							</div>
						</div>

						{/* Socket Path */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Socket path</span>
							</label>
							<div className="join w-full">
								<input
									type="text"
									className="input input-bordered join-item flex-1"
									value={config.socket_path || ""}
									onChange={(e) =>
										setConfig((prev) => ({
											...prev,
											socket_path: e.target.value,
										}))
									}
									placeholder="/tmp/waypaper-engine.sock"
									disabled={saving}
								/>
								<button
									className="btn btn-outline join-item"
									onClick={() => saveConfig("socket_path", config.socket_path)}
									disabled={saving}
								>
									Save
								</button>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Unix socket path for daemon communication
								</span>
							</div>
						</div>

						{/* Log File */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Log file path</span>
							</label>
							<div className="join w-full">
								<input
									type="text"
									className="input input-bordered join-item flex-1"
									value={config.log_file || ""}
									onChange={(e) =>
										setConfig((prev) => ({ ...prev, log_file: e.target.value }))
									}
									placeholder="/var/log/waypaper-engine.log"
									disabled={saving}
								/>
								<button
									className="btn btn-outline join-item"
									onClick={() => saveConfig("log_file", config.log_file)}
									disabled={saving}
								>
									Save
								</button>
							</div>
							<div className="label">
								<span className="label-text-alt">
									Path to the daemon log file
								</span>
							</div>
						</div>

						{/* Max Connections */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">Max connections</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.max_connections || 10}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										max_connections: parseInt(e.target.value),
									}))
								}
								min="1"
								max="100"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Maximum number of concurrent connections
								</span>
							</div>
						</div>

						{/* Heartbeat Interval */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">
									Heartbeat interval (ms)
								</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.heartbeat_interval || 5000}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										heartbeat_interval: parseInt(e.target.value),
									}))
								}
								min="1000"
								max="60000"
								step="1000"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Interval for heartbeat checks in milliseconds
								</span>
							</div>
						</div>

						{/* Timeout */}
						<div className="form-control">
							<label className="label">
								<span className="label-text text-lg">
									Connection timeout (ms)
								</span>
							</label>
							<input
								type="number"
								className="input input-bordered w-full max-w-xs"
								value={config.timeout || 30000}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										timeout: parseInt(e.target.value),
									}))
								}
								min="5000"
								max="300000"
								step="5000"
								disabled={saving}
							/>
							<div className="label">
								<span className="label-text-alt">
									Connection timeout in milliseconds
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
					onClick={loadData}
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
					Refresh
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

export default DaemonSettings;
