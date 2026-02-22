import pino from "pino";
import { configManager } from "../shared/configManager";

const electronConfig = configManager.getElectronConfig();
const logFilePath = configManager.getElectronLogFile();

const level =
	process.env.WAYPAPER_LOG_LEVEL || electronConfig.log_level || "info";

const maxSize = (electronConfig.log_max_size || 10) * 1024 * 1024;

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
