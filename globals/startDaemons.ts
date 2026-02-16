import { spawn } from "child_process";
import { request as httpRequest } from "node:http";
import { daemonPath, logger } from "./setup";
import { access, mkdir } from "node:fs";
import { promisify } from "node:util";
import { configReader } from "./configReader";
import { dirname } from "node:path";

const fsMkdir = promisify(mkdir);
const fsAccess = promisify(access);

// Get socket path from TOML configuration
const WAYPAPER_ENGINE_SOCKET_PATH = configReader.getSocketPath();

// Keep reference to daemon process
let daemonProcess: any = null;

export async function initWaypaperDaemon() {
	try {
		// First, ensure all required directories exist
		await ensureDirectoriesExist();

		// Clean up any existing socket file and processes
		try {
			await fsAccess(WAYPAPER_ENGINE_SOCKET_PATH);
			logger.info("Found existing socket file, cleaning up...");
			// Try to connect to existing daemon first
			try {
				await testConnection();
				logger.info("Existing daemon is responsive, using it");
				return; // Use existing daemon
			} catch (error) {
				logger.info("Existing daemon is not responsive, cleaning up socket");
				// Remove stale socket file
				const { unlink } = await import("node:fs/promises");
				await unlink(WAYPAPER_ENGINE_SOCKET_PATH);
			}
		} catch (error) {
			// Socket doesn't exist, proceed to start daemon
			logger.info("No existing socket file found");
		}

		// Kill any existing swww daemon processes that might conflict
		try {
			const { exec } = await import("node:child_process");
			const { promisify } = await import("node:util");
			const execAsync = promisify(exec);

			logger.info("Checking for existing swww daemon processes...");
			const { stdout } = await execAsync("pgrep swww-daemon || true");
			if (stdout.trim()) {
				logger.info("Found existing swww daemon processes, killing them...");
				await execAsync("pkill swww-daemon || true");
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		} catch (error) {
			logger.warn("Failed to clean up existing swww processes:", error);
		}

		// Launch Go daemon
		const goDaemonPath = daemonPath;
		logger.info(`Starting waypaper-daemon at: ${goDaemonPath}`);

		const output = spawn(goDaemonPath, [], {
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
			detached: false,
			env: { ...process.env },
		});

		logger.info(`Daemon process spawned with PID: ${output.pid}`);
		daemonProcess = output;

		output.stdout?.on("data", (data) => {
			logger.info(`Go daemon stdout: ${data.toString()}`);
		});

		output.stderr?.on("data", (data) => {
			logger.error(`Go daemon stderr: ${data.toString()}`);
		});

		output.on("error", (error) => {
			logger.error(`Go daemon spawn error: ${error}`);
			throw error;
		});

		output.on("exit", (code, signal) => {
			logger.error(`Go daemon exited with code ${code}, signal ${signal}`);
		});

		// Wait for socket to be created and daemon to be responsive
		let daemonReady = false;
		let attempts = 0;
		const maxAttempts = 20;
		const retryInterval = 500;

		while (!daemonReady && attempts < maxAttempts) {
			attempts++;
			logger.info(
				`Waiting for daemon to be ready... attempt ${attempts}/${maxAttempts}`,
			);

			try {
				if (daemonProcess && daemonProcess.killed) {
					logger.error("Daemon process has been killed");
					throw new Error("Daemon process was killed");
				}

				await fsAccess(WAYPAPER_ENGINE_SOCKET_PATH);
				logger.info("Socket file exists, testing connection...");

				await testConnection();
				daemonReady = true;
				logger.info("Daemon is ready and responsive");
			} catch (error) {
				logger.debug(`Connection attempt ${attempts} failed:`, error);
				if (attempts < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, retryInterval));
				}
			}
		}

		if (!daemonReady) {
			if (output && !output.killed) {
				output.kill("SIGTERM");
			}
			throw new Error("Daemon failed to become ready after maximum attempts");
		}

		logger.info("Waypaper daemon started successfully");
	} catch (error) {
		logger.error("Failed to start waypaper-daemon:", error);
		logger.warn("Could not start waypaper-daemon, shutting down app...");
		process.exit(1);
	}
}

export function getDaemonProcess() {
	return daemonProcess;
}

export function isDaemonRunning() {
	return (
		daemonProcess && !daemonProcess.killed && daemonProcess.exitCode === null
	);
}

async function ensureDirectoriesExist() {
	const config = configReader.getCurrentConfig();

	const directories = [
		config.daemon.database_path,
		config.daemon.images_dir,
		config.daemon.thumbnails_dir,
		dirname(config.daemon.monitors_state_file),
		dirname(WAYPAPER_ENGINE_SOCKET_PATH),
	];

	for (const dir of directories) {
		try {
			await fsMkdir(dir, { recursive: true });
			logger.debug(`Ensured directory exists: ${dir}`);
		} catch (error) {
			logger.warn(`Failed to create directory ${dir}:`, error);
		}
	}
}

async function testConnection(): Promise<void> {
	const MAX_ATTEMPTS = 5;
	const RETRY_INTERVAL = 200;
	let attempt = 1;
	while (attempt <= MAX_ATTEMPTS) {
		try {
			await healthCheck(WAYPAPER_ENGINE_SOCKET_PATH);
			logger.info("Connection to Go daemon established via HTTP.");
			return;
		} catch (error) {
			logger.debug(`Connection attempt ${attempt} failed:`, error);
			if (attempt < MAX_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
				attempt++;
			} else {
				throw error;
			}
		}
	}
}

async function healthCheck(socketPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const req = httpRequest(
			{
				socketPath,
				path: "/healthz",
				method: "GET",
				headers: { Accept: "application/json" },
			},
			(res) => {
				let data = "";
				res.on("data", (chunk: Buffer) => {
					data += chunk.toString();
				});
				res.on("end", () => {
					if (res.statusCode === 200) {
						try {
							const body = JSON.parse(data);
							if (body.status === "ok") {
								resolve();
								return;
							}
						} catch {
							// fall through
						}
					}
					reject(new Error(`Health check failed: HTTP ${res.statusCode}`));
				});
			},
		);

		req.on("error", (err) => reject(err));
		req.setTimeout(2000, () => {
			req.destroy();
			reject(new Error("Health check timeout"));
		});
		req.end();
	});
}
