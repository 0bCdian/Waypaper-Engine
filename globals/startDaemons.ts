import { execSync, spawn } from "child_process";
import { daemonPath, logger } from "./setup";
import { configuration } from "../globals/config";
import { createConnection, createServer } from "node:net";
import { type message } from "../types/types";
import { unlinkSync, writeFileSync, access } from "node:fs";
import EventEmitter from "node:events";
import { existsSync } from "fs";
import { promisify } from "node:util";

const setTimeoutPromise = promisify(setTimeout);
const fsAccess = promisify(access);
function checkIfSwwwIsInstalled() {
    try {
        execSync(`swww --version`);
        console.info("swww is installed in the system");
    } catch (error) {
        console.warn(
            "swww is not installed, please find instructions in the README.md on how to install it"
        );
        logger.error(error);
        throw new Error("swww is not installed");
    }
}
export function isSwwwRunning() {
    try {
        execSync('ps -A | grep "swww-daemon"');
        return true;
    } catch (e) {
        return false;
    }
}

export function initSwwwDaemon() {
    checkIfSwwwIsInstalled();
    try {
        if (configuration.format && isSwwwRunning()) {
            execSync("swww kill");
        }
        const command = `swww-daemon --no-cache ${configuration.format ? "--format xrgb" : ""} &`;
        const output = spawn(command, {
            stdio: "ignore",
            shell: true,
            detached: true
        });
        output.unref();
    } catch (error) {
        logger.error(error);
    }
}
export function isWaypaperDaemonRunning() {
    try {
        execSync(`pidof ${configuration.DAEMON_PID}`);
        return existsSync(configuration.directories.DAEMON_LOCK_FILE);
    } catch (_err) {
        return false;
    }
}
export function acquireLock() {
    const lockFile = configuration.directories.DAEMON_LOCK_FILE;
    try {
        writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
        return true;
    } catch (err) {
        // @ts-expect-error .code does exists
        if (err instanceof Error && err.code === "EEXIST") {
            return false;
        }
        throw err;
    }
}

export function releaseLock() {
    const lockFile = configuration.directories.DAEMON_LOCK_FILE;
    try {
        unlinkSync(lockFile);
    } catch (err) {
        // @ts-expect-error .code does exists
        if (err instanceof Error && err.code !== "ENOENT") {
            logger.error("Error releasing lock:", err);
        }
    }
}

export async function initWaypaperDaemon() {
    try {
        // Check if daemon is already running
        const SOCKET_PATH = "/tmp/waypaper_engine.sock";
        
        // First, check if socket exists (daemon might already be running)
        try {
            await fsAccess(SOCKET_PATH);
            logger.info("Socket file exists, daemon is already running");
            await testConnection();
            return; // Daemon is already running, no need to start a new one
        } catch (error) {
            // Socket doesn't exist, proceed to start daemon
            logger.info("Socket file not found, starting new daemon...");
        }
        
        // Launch Go daemon
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
                await fsAccess(SOCKET_PATH);
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
    // Use the same socket path as the Go daemon
    const SOCKET_PATH = "/tmp/waypaper_engine.sock";
    const MAX_ATTEMPTS = 10;
    const RETRY_INTERVAL = 300;
    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
        try {
            await connectToDaemon(SOCKET_PATH);
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
            const client = createConnection(socketPath, () => {
                client.end();
                resolve("");
            });
            client.on("error", err => {
                reject(err);
            });
        } catch (error) {
            logger.error(error);
            logger.error(
                "failed to test connection, this is because createConnection trhew"
            );
        }
    });
}

export function createMainServer() {
    const emitter = new EventEmitter();
    
    // Set up Go daemon connection asynchronously
    (async () => {
        try {
            // Import the Go daemon client
            const { goDaemonClient } = await import("../electron/goDaemonClient");
            
            // Connect to Go daemon and forward events
            await goDaemonClient.connect();
            logger.info("Connected to Go daemon for event forwarding");
            
            // Forward events from Go daemon to Electron
            goDaemonClient.on("playlist_started", (data) => {
                emitter.emit("playlist_started", data);
            });
            
            goDaemonClient.on("playlist_stopped", (data) => {
                emitter.emit("playlist_stopped", data);
            });
            
            goDaemonClient.on("playlist_paused", (data) => {
                emitter.emit("playlist_paused", data);
            });
            
            goDaemonClient.on("playlist_resumed", (data) => {
                emitter.emit("playlist_resumed", data);
            });
            
            goDaemonClient.on("image_changed", (data) => {
                emitter.emit("image_changed", data);
            });
            
            goDaemonClient.on("wallpaper_changed", (data) => {
                emitter.emit("wallpaper_changed", data);
            });
            
            goDaemonClient.on("images_updated", (data) => {
                emitter.emit("images_updated", data);
            });
            
            goDaemonClient.on("config_changed", (data) => {
                emitter.emit("config_changed", data);
            });
            
        } catch (error) {
            logger.error("Failed to connect to Go daemon:", error);
        }
    })();
    
    // Keep the old server for backward compatibility with existing IPC
    const serverInstance = createServer(socket => {
        socket.on("data", buffer => {
            buffer
                .toString()
                .split("\n")
                .filter(message => message !== "")
                .forEach(message => {
                    try {
                        const parsedMessage: message = JSON.parse(message);
                        emitter.emit(parsedMessage.action);
                    } catch (error) {
                        logger.error(error);
                    }
                });
        });
        socket.on("error", err => {
            logger.error("Socket error:", err.message);
        });
    });
    
    serverInstance.on("error", err => {
        if (err.message.includes("EADDRINUSE")) {
            unlinkSync(configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH);
            serverInstance.listen(
                configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH
            );
        } else {
            logger.error(err);
            throw err;
        }
    });
    
    serverInstance.listen(
        configuration.directories.WAYPAPER_ENGINE_SOCKET_PATH
    );
    
    return emitter;
}
