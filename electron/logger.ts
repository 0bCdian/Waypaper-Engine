import pino from "pino";
import { configReader } from "../globals/configReader";

const electronConfig = configReader.getElectronConfig();
const logFilePath = configReader.getElectronLogFile();

const level = process.env.WAYPAPER_LOG_LEVEL || electronConfig.log_level || "info";

const maxSize = (electronConfig.log_max_size_mb || 10) * 1024 * 1024;

export const logger = pino({
  level,
  transport: {
    targets: [
      {
        target: "pino-roll",
        options: {
          file: logFilePath,
          size: maxSize,
          mkdir: true,
        },
        level,
      },
      {
        target: "pino/file",
        options: { destination: 2 },
        level,
      },
    ],
  },
});
