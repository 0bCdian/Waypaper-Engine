import { DaemonManager } from "./daemonManager";
import {
    isWaypaperDaemonRunning,
    initSwwwDaemon
} from "../globals/startDaemons";
import { notify } from "../utils/notifications";
import { logger } from "../globals/setup";

if (isWaypaperDaemonRunning()) {
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
        process.exit(0);
    });
    process.on("SIGINT", () => {
        notify("Exiting daemon...");
        daemonManager.cleanUp();
        process.exit(0);
    });
    process.on("uncaughtException", _ => {
        notify(
            `Daemon crashed, run with --logs to generate flags in $HOME/.waypaper_engine/`
        );
        daemonManager.cleanUp();
        process.exit(1);
    });
    process.on("unhandledRejection", _ => {
        notify(
            `Daemon crashed, run with --logs to generate flags in $HOME/.waypaper_engine/`
        );
        daemonManager.cleanUp();
        process.exit(1);
    });
} catch (error) {
    logger.error(error);
    process.exit(1);
}
