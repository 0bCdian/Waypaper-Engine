import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import pino from "pino";
import { configReader } from "./configReader";
import { configManager } from "../shared/configManager";
const isPackaged = !(process.env.NODE_ENV === "development");
export const isDaemon = process.env.PROCESS === "daemon";
export const mainDirectory = join(homedir(), ".waypaper_engine");
if (!existsSync(mainDirectory)) {
    mkdirSync(mainDirectory);
}
// Get logging configuration from TOML
const electronConfig = configManager.getElectronConfig();
const logPath = isDaemon
    ? join(mainDirectory, "daemon.log")
    : configManager.getElectronLogFile();

const resourcesPath = join(__dirname, "..", "..");
export const iconsPath = resolve(
    isPackaged
        ? join(resourcesPath, "./icons")
        : join(process.cwd(), "build/icons")
);
// Get daemon path from TOML configuration
export const daemonPath = configReader.getDaemonPath();

export const nativeBindingPath = resolve(
    isPackaged
        ? join(resourcesPath, "better_sqlite3.node")
        : join(
              process.cwd(),
              "/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
          )
);

export const migrationsPath = resolve(
    isPackaged
        ? join(resourcesPath, "migrations")
        : join(process.cwd(), "/database/migrations")
);

export const migrationsPathDaemon = resolve(
    isPackaged
        ? join(resourcesPath, "..", "migrations")
        : join(process.cwd(), "..", "..", "..", "/database/migrations")
);
export const { values } = parseArgs({
    args: process.argv,
    options: {
        daemon: {
            type: "boolean",
            short: "d",
            default: false
        },
        format: {
            type: "boolean",
            short: "f",
            default: false
        },
        logs: {
            type: "boolean",
            short: "l",
            default: false
        }
    },
    strict: false
});

type customLogger = {
    error: (message: unknown, ...args: unknown[]) => void;
    info: (message: unknown, ...args: unknown[]) => void;
    warn: (message: unknown, ...args: unknown[]) => void;
    debug: (message: unknown, ...args: unknown[]) => void;
};

export let logger: customLogger;

if (values.logs === true) {
    const parentLogger = pino({
        level: electronConfig.log_level,
        transport: {
            target: 'pino/file',
            options: {
                destination: logPath,
                mkdir: true
            }
        }
    });
    const pinoLogger = parentLogger.child({
        module: isDaemon ? "daemon" : "electron"
    });
    logger = pinoLogger;
} else {
    logger = console;
}

process.on("uncaughtException", error => {
    logger.error(error);
});
process.on("unhandledRejection", error => {
    logger.error(error);
});
