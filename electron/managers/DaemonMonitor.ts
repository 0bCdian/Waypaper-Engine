/**
 * Daemon Monitor for Electron Main Process
 *
 * Handles daemon health checks, status monitoring, and restart functionality.
 */

import { BrowserWindow } from "electron";
import { goDaemonClient } from "../goDaemonClient";
import { initWaypaperDaemon } from "../../globals/startDaemons";

export interface DaemonStatus {
	isRunning: boolean;
	lastChecked: number;
	lastError?: string;
}

export class DaemonMonitor {
	private healthCheckInterval: NodeJS.Timeout | null = null;
	private status: DaemonStatus = {
		isRunning: false,
		lastChecked: 0,
	};
	private windows: Set<BrowserWindow> = new Set();
	private isMonitoring = false;

	/**
	 * Start monitoring the daemon
	 */
	startMonitoring(intervalMs: number = 1000): void {
		if (this.isMonitoring) {
			("DaemonMonitor: Already monitoring");
			return;
		}

		this.isMonitoring = true;
		`DaemonMonitor: Starting health checks every ${intervalMs}ms`;

		// Initial health check
		this.performHealthCheck();

		// Set up interval
		this.healthCheckInterval = setInterval(() => {
			this.performHealthCheck();
		}, intervalMs);
	}

	/**
	 * Stop monitoring the daemon
	 */
	stopMonitoring(): void {
		if (!this.isMonitoring) {
			return;
		}

		this.isMonitoring = false;
		("DaemonMonitor: Stopping health checks");

		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}
	}

	/**
	 * Register a window to receive daemon status updates
	 */
	registerWindow(window: BrowserWindow): void {
		this.windows.add(window);
	}

	/**
	 * Unregister a window
	 */
	unregisterWindow(window: BrowserWindow): void {
		this.windows.delete(window);
	}

	/**
	 * Get current daemon status
	 */
	getStatus(): DaemonStatus {
		return { ...this.status };
	}

	/**
	 * Perform a health check on the daemon
	 */
	private async performHealthCheck(): Promise<void> {
		try {
			// Try to ping the daemon
			const pingResult = await goDaemonClient.ping();

			let newStatus: DaemonStatus;

			if (pingResult) {
				// Daemon is responding, try to get more detailed status
				try {
					await goDaemonClient.getDaemonStatus();

					newStatus = {
						isRunning: true,
						lastChecked: Date.now(),
						lastError: undefined,
					};
				} catch (error) {
					// Ping worked but getDaemonStatus failed
					newStatus = {
						isRunning: true,
						lastChecked: Date.now(),
						lastError: `Status query failed: ${error instanceof Error ? error.message : String(error)}`,
					};
				}
			} else {
				newStatus = {
					isRunning: false,
					lastChecked: Date.now(),
					lastError: "Ping failed",
				};
			}

			// Only broadcast if status actually changed
			const statusChanged =
				this.status.isRunning !== newStatus.isRunning ||
				this.status.lastError !== newStatus.lastError;

			this.status = newStatus;

			if (statusChanged) {
				("DaemonMonitor: Status changed, broadcasting update");
				this.broadcastStatusUpdate();
			}
		} catch (error) {
			const newStatus = {
				isRunning: false,
				lastChecked: Date.now(),
				lastError: error instanceof Error ? error.message : String(error),
			};

			// Only broadcast if status actually changed
			const statusChanged =
				this.status.isRunning !== newStatus.isRunning ||
				this.status.lastError !== newStatus.lastError;

			this.status = newStatus;

			if (statusChanged) {
				("DaemonMonitor: Status changed to error, broadcasting update");
				this.broadcastStatusUpdate();
			}
		}
	}

	/**
	 * Broadcast daemon status to all registered windows
	 */
	private broadcastStatusUpdate(): void {
		const statusUpdate = {
			type: "daemon-status-update",
			data: this.status,
		};

		this.windows.forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send("daemon-status-update", statusUpdate);
			}
		});
	}

	/**
	 * Restart the daemon
	 */
	async restartDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			("DaemonMonitor: Restarting daemon...");

			// Stop the daemon first
			try {
				await goDaemonClient.stopDaemon();
				("DaemonMonitor: Daemon stopped successfully");
			} catch (error) {
				console.warn("DaemonMonitor: Error stopping daemon:", error);
				// Continue with restart even if stop failed
			}

			// Wait a moment for the daemon to fully stop
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Start the daemon
			try {
				await goDaemonClient.startDaemon();
				("DaemonMonitor: Daemon started successfully");

				// Perform immediate health check
				await this.performHealthCheck();

				return { success: true };
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error("DaemonMonitor: Failed to start daemon:", errorMessage);
				return { success: false, error: errorMessage };
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("DaemonMonitor: Failed to restart daemon:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Start the daemon
	 */
	async startDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			("DaemonMonitor: Starting daemon...");
			await initWaypaperDaemon();
			("DaemonMonitor: Daemon started successfully");

			// Wait a moment for the daemon to fully initialize
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Perform immediate health check
			await this.performHealthCheck();

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("DaemonMonitor: Failed to start daemon:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Stop the daemon
	 */
	async stopDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			("DaemonMonitor: Stopping daemon...");
			await goDaemonClient.stopDaemon();
			("DaemonMonitor: Daemon stopped successfully");

			// Update status immediately
			this.status = {
				isRunning: false,
				lastChecked: Date.now(),
				lastError: "Manually stopped",
			};
			this.broadcastStatusUpdate();

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("DaemonMonitor: Failed to stop daemon:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Cleanup
	 */
	cleanup(): void {
		this.stopMonitoring();
		this.windows.clear();
		("DaemonMonitor: Cleaned up");
	}
}

// Export singleton instance
export const daemonMonitor = new DaemonMonitor();
