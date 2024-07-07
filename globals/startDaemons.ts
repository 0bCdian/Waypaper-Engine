import { execSync, spawn } from "child_process";
import { daemonPath, logger } from "./setup";
import { configuration } from "../globals/config";
import { createConnection, createServer } from "node:net";
import { type message } from "../types/types";
import { unlinkSync, writeFileSync } from "node:fs";
import EventEmitter from "node:events";
import { existsSync } from "fs";
import { promisify } from "node:util";

const setTimeoutPromise = promisify(setTimeout);
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
        const args = [`${daemonPath}/daemon.js`];
        if (configuration.format) {
            args.push(`--format`);
        }
        if (configuration.logs) {
            args.push(`--logs`);
        }
        const output = spawn("PROCESS=daemon node", args, {
            stdio: "ignore",
            shell: true,
            detached: true,
            env: { ...process.env }
        });
        output.unref();
        await testConnection();
    } catch (error) {
        logger.error(error);
        logger.warn("Could not start waypaper-daemon, shutting down app...");
        process.exit(1);
    }
}
async function testConnection() {
    const SOCKET_PATH =
        configuration.directories.WAYPAPER_ENGINE_DAEMON_SOCKET_PATH;
    const MAX_ATTEMPTS = 10;
    const RETRY_INTERVAL = 300;
    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
        try {
            await connectToDaemon(SOCKET_PATH);
            logger.info("Connection to waypaper daemon established.");
            return;
        } catch (error) {
            await setTimeoutPromise(RETRY_INTERVAL);
            attempt++;
        }
    }
    throw new Error("Failed to establish connection to waypaper daemon.");
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
