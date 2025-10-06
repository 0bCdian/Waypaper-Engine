import { spawn } from "child_process";
import { daemonPath, logger } from "./setup";
import { access } from "node:fs";
import { promisify } from "node:util";
import { configReader } from "./configReader";

const setTimeoutPromise = promisify(setTimeout);
const fsAccess = promisify(access);

// Get socket paths from TOML configuration
const WAYPAPER_ENGINE_SOCKET_PATH = configReader.getSocketPath();

export async function initWaypaperDaemon() {
    try {
        // Check if daemon is already running
        try {
            await fsAccess(WAYPAPER_ENGINE_SOCKET_PATH);
            logger.info("Socket file exists, daemon is already running");
            await testConnection();
            return; // Daemon is already running, no need to start a new one
        } catch (error) {
            // Socket doesn't exist, proceed to start daemon
            logger.info("Socket file not found, starting new daemon...");
        }
        
        // Launch Go daemon - it handles its own locking and swww initialization
        const goDaemonPath = daemonPath;
        logger.info(`Starting waypaper-daemon at: ${goDaemonPath}`);
        
        const output = spawn(goDaemonPath, [], {
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
            detached: true,
            env: { ...process.env }
        });
        
        // Log daemon output for debugging
        output.stdout?.on('data', (data) => {
            logger.info(`Go daemon stdout: ${data.toString()}`);
        });
        
        output.stderr?.on('data', (data) => {
            logger.error(`Go daemon stderr: ${data.toString()}`);
        });
        
        output.on('error', (error) => {
            logger.error(`Go daemon spawn error: ${error}`);
        });
        
        output.on('exit', (code, signal) => {
            logger.warn(`Go daemon exited with code ${code}, signal ${signal}`);
        });
        
        output.unref();
        
        // Give the daemon a moment to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Wait for socket to be created
        let socketExists = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!socketExists && attempts < maxAttempts) {
            try {
                await fsAccess(WAYPAPER_ENGINE_SOCKET_PATH);
                socketExists = true;
                logger.info("Socket file exists, daemon is ready");
            } catch (error) {
                attempts++;
                logger.info(`Waiting for socket... attempt ${attempts}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (!socketExists) {
            throw new Error("Daemon socket not created after maximum attempts");
        }
        
        await testConnection();
    } catch (error) {
        logger.error(error);
        logger.warn("Could not start waypaper-daemon, shutting down app...");
        process.exit(1);
    }
}
async function testConnection() {
    const MAX_ATTEMPTS = 10;
    const RETRY_INTERVAL = 300;
    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
        try {
            await connectToDaemon(WAYPAPER_ENGINE_SOCKET_PATH);
            logger.info("Connection to Go daemon established.");
            return;
        } catch (error) {
            await setTimeoutPromise(RETRY_INTERVAL);
            attempt++;
        }
    }
    throw new Error("Failed to establish connection to Go daemon.");
}

async function connectToDaemon(socketPath: string) {
    return await new Promise((resolve, reject) => {
        try {
            const { createConnection } = require("node:net");
            const client = createConnection(socketPath, () => {
                client.end();
                resolve("");
            });
            client.on("error", (err: Error) => {
                reject(err);
            });
        } catch (error) {
            logger.error(error);
            logger.error(
                "failed to test connection, this is because createConnection threw"
            );
        }
    });
}
