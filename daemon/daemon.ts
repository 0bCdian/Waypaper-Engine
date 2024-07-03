import { DaemonManager } from "./daemonManager";
import {
    initSwwwDaemon,
    acquireLock,
    releaseLock
} from "../globals/startDaemons";
import { notify } from "../utils/notifications";
import { logger } from "../globals/setup";

if (!acquireLock()) {
    logger.warn("Another instance is already running");
    process.exit(1);
}
initSwwwDaemon();
process.title = "wpe-daemon";
try {
    const daemonManager = new DaemonManager();
    process.on("SIGTERM", function () {
        notify("Exiting daemon...");
        daemonManager.cleanUp();
        releaseLock();
        process.exit(0);
    });
    process.on("SIGINT", () => {
        notify("Exiting daemon...");
        daemonManager.cleanUp();
        releaseLock();
        process.exit(0);
    });
    process.on("uncaughtException", _ => {
        notify(
            `Daemon crashed, run with --logs to generate flags in $HOME/.waypaper_engine/`
        );
        daemonManager.cleanUp();
        releaseLock();
        process.exit(1);
    });
    process.on("unhandledRejection", _ => {
        notify(
            `Daemon crashed, run with --logs to generate flags in $HOME/.waypaper_engine/`
        );
        daemonManager.cleanUp();
        releaseLock();
        process.exit(1);
    });
    process.on("exit", releaseLock);
} catch (error) {
    logger.error(error);
    releaseLock();
    process.exit(1);
}
