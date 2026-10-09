import { parseArgs } from "node:util";
import { configReader } from "./configReader";

export { logger } from "../electron/logger";

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
