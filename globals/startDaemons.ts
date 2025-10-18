import { spawn } from "child_process";
import { daemonPath, logger } from "./setup";
import { access, mkdir } from "node:fs";
import { promisify } from "node:util";
import { configReader } from "./configReader";
import { dirname } from "node:path";

const fsMkdir = promisify(mkdir);
const setTimeoutPromise = promisify(setTimeout);
const fsAccess = promisify(access);

// Get socket paths from TOML configuration
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
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for cleanup
			}
		} catch (error) {
			logger.warn("Failed to clean up existing swww processes:", error);
		}

		// Launch Go daemon - it handles its own locking and swww initialization
		const goDaemonPath = daemonPath;
		logger.info(`Starting waypaper-daemon at: ${goDaemonPath}`);

		const output = spawn(goDaemonPath, [], {
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
			detached: false, // Keep reference to the process
			env: { ...process.env },
		});

		logger.info(`Daemon process spawned with PID: ${output.pid}`);

		// Keep reference to the process
		daemonProcess = output;

		// Log daemon output for debugging
		output.stdout?.on("data", (data) => {
			logger.info(`Go daemon stdout: ${data.toString()}`);
		});

		output.stderr?.on("data", (data) => {
			logger.error(`Go daemon stderr: ${data.toString()}`);
		});

		output.on("error", (error) => {
			logger.error(`Go daemon spawn error: ${error}`);
			throw error; // Re-throw to trigger error handling
		});

		output.on("exit", (code, signal) => {
			logger.error(`Go daemon exited with code ${code}, signal ${signal}`);
			logger.error("Daemon process has exited unexpectedly");
			// Don't exit the app immediately, let the connection test handle it
		});

		// Don't call unref() - we want to keep the process reference

		// Wait for socket to be created and daemon to be responsive
		let daemonReady = false;
		let attempts = 0;
		const maxAttempts = 20; // Increased attempts
		const retryInterval = 500; // 500ms intervals

		while (!daemonReady && attempts < maxAttempts) {
			attempts++;
			logger.info(
				`Waiting for daemon to be ready... attempt ${attempts}/${maxAttempts}`,
			);

			try {
				// Check if daemon process is still running
				if (daemonProcess && daemonProcess.killed) {
					logger.error("Daemon process has been killed");
					throw new Error("Daemon process was killed");
				}

				// First check if socket exists
				await fsAccess(WAYPAPER_ENGINE_SOCKET_PATH);
				logger.info("Socket file exists, testing connection...");

				// Then test if daemon is actually responsive
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
			// Kill the daemon process if it's still running
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

	// Create all required directories
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
async function testConnection() {
	const MAX_ATTEMPTS = 5;
	const RETRY_INTERVAL = 200;
	let attempt = 1;
	while (attempt <= MAX_ATTEMPTS) {
		try {
			await connectToDaemon(WAYPAPER_ENGINE_SOCKET_PATH);
			logger.info("Connection to Go daemon established.");
			return;
		} catch (error) {
			logger.debug(`Connection attempt ${attempt} failed:`, error);
			if (attempt < MAX_ATTEMPTS) {
				await setTimeoutPromise(RETRY_INTERVAL);
				attempt++;
			} else {
				throw error;
			}
		}
	}
}

async function connectToDaemon(socketPath: string) {
	return await new Promise((resolve, reject) => {
		try {
			const { createConnection } = require("node:net");
			let responseData = "";
			let responseReceived = false;

			const client = createConnection(socketPath, () => {
				// Send a ping command to test responsiveness
				const pingMessage =
					JSON.stringify({ action: "ping", messageId: 1 }) + "\n";
				client.write(pingMessage);

				// Set up response handler
				client.on("data", (data: Buffer) => {
					responseData += data.toString();
					// Check if we got a complete JSON response
					try {
						const lines = responseData.split("\n");
						for (const line of lines) {
							if (line.trim()) {
								const response = JSON.parse(line);
								if (response.action === "pong" || response.messageId === 1) {
									responseReceived = true;
									client.end();
									resolve("pong");
									return;
								}
							}
						}
					} catch (e) {
						// Continue waiting for complete response
					}
				});

				// Set timeout for response
				setTimeout(() => {
					client.end();
					reject(new Error("Daemon ping timeout"));
				}, 2000);
			});

			client.on("error", (err: Error) => {
				reject(err);
			});

			client.on("close", () => {
				// Connection closed without proper response
				if (!responseReceived) {
					reject(new Error("Daemon connection closed unexpectedly"));
				}
			});
		} catch (error) {
			logger.error("Failed to test daemon connection:", error);
			reject(error);
		}
	});
}
