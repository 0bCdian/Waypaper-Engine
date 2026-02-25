import { join } from "node:path";
import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import { configReader } from "./configReader";

export { logger } from "../electron/logger";

export const mainDirectory = join(homedir(), ".waypaper_engine");
if (!existsSync(mainDirectory)) {
  mkdirSync(mainDirectory);
}

export const daemonPath = configReader.getDaemonPath();

const { values } = parseArgs({
  args: process.argv,
  options: {
    debug: {
      type: "boolean",
      default: false,
    },
  },
  strict: false,
});

export const isDebugMode = values.debug === true;
