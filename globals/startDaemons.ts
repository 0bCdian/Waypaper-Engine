import { spawn } from "child_process";
import { request as httpRequest } from "node:http";
import { access, unlink } from "node:fs/promises";
import { daemonPath, logger, isDebugMode } from "./setup";
import { configReader } from "./configReader";

// Get socket path from TOML configuration
const WAYPAPER_ENGINE_SOCKET_PATH = configReader.getSocketPath();

// Keep reference to daemon process
let daemonProcess: import("child_process").ChildProcess | null = null;

export async function initWaypaperDaemon() {
	try {
		// Clean up any existing socket file and processes
		try {
			await access(WAYPAPER_ENGINE_SOCKET_PATH);
			logger.info("Found existing socket file, cleaning up...");
			// Try to connect to existing daemon first
			try {
				await testConnection();
				logger.info("Existing daemon is responsive, using it");
				return; // Use existing daemon
			} catch (error) {
				logger.info("Existing daemon is not responsive, cleaning up socket");
				await unlink(WAYPAPER_ENGINE_SOCKET_PATH);
			}
		} catch (error) {
			// Socket doesn't exist, proceed to start daemon
			logger.info("No existing socket file found");
		}

		const daemonArgs = isDebugMode ? ["-l", "debug"] : [];
		logger.info(`Starting waypaper-daemon at: ${daemonPath} ${daemonArgs.join(" ")}`);

		const output = spawn(daemonPath, daemonArgs, {
			stdio: "ignore",
			shell: true,
			detached: true,
			env: { ...process.env },
		});
		output.unref();

		logger.info(`Daemon process spawned with PID: ${output.pid}`);
		daemonProcess = output;

		output.on("error", (error) => {
			logger.error({ err: error }, "Go daemon spawn error");
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

				await access(WAYPAPER_ENGINE_SOCKET_PATH);
				logger.info("Socket file exists, testing connection...");

				await testConnection();
				daemonReady = true;
				logger.info("Daemon is ready and responsive");
			} catch (error) {
				logger.debug({ err: error, attempt: attempts }, "Connection attempt failed");
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
		logger.error({ err: error }, "Failed to start waypaper-daemon");
		throw new Error(
			`Could not start waypaper-daemon: ${error instanceof Error ? error.message : String(error)}`,
		);
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
			logger.debug({ err: error, attempt }, "Connection attempt failed");
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
