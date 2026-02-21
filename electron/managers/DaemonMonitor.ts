/**
 * Daemon Monitor for Electron Main Process
 *
 * Handles daemon health checks, status monitoring, and restart functionality.
 */

import type { BrowserWindow } from "electron";
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

	startMonitoring(intervalMs: number = 5000): void {
		if (this.isMonitoring) return;

		this.isMonitoring = true;
		this.performHealthCheck();

		this.healthCheckInterval = setInterval(() => {
			this.performHealthCheck();
		}, intervalMs);
	}

	stopMonitoring(): void {
		if (!this.isMonitoring) return;

		this.isMonitoring = false;
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}
	}

	registerWindow(window: BrowserWindow): void {
		this.windows.add(window);
	}

	getStatus(): DaemonStatus {
		return { ...this.status };
	}

	private async performHealthCheck(): Promise<void> {
		let isRunning = false;
		let lastError: string | undefined;
		try {
			isRunning = await goDaemonClient.ping();
			if (!isRunning) lastError = "Health check failed";
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}

		const newStatus: DaemonStatus = {
			isRunning,
			lastChecked: Date.now(),
			lastError,
		};
		const changed =
			this.status.isRunning !== newStatus.isRunning ||
			this.status.lastError !== newStatus.lastError;
		this.status = newStatus;
		if (changed) this.broadcastStatusUpdate();
	}

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

	async restartDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			try {
				await goDaemonClient.shutdown();
			} catch (error) {
				console.warn("DaemonMonitor: Error stopping daemon:", error);
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));

			await initWaypaperDaemon();

			// Reconnect the client
			await goDaemonClient.connect();

			await this.performHealthCheck();

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("DaemonMonitor: Failed to restart daemon:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	async startDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			await initWaypaperDaemon();

			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Connect the client
			await goDaemonClient.connect();

			await this.performHealthCheck();

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("DaemonMonitor: Failed to start daemon:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	async stopDaemon(): Promise<{ success: boolean; error?: string }> {
		try {
			await goDaemonClient.shutdown();

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

	cleanup(): void {
		this.stopMonitoring();
		this.windows.clear();
	}
}

export const daemonMonitor = new DaemonMonitor();
