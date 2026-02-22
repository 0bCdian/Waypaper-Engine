type LogLevel = "debug" | "info" | "warn" | "error";

function forward(
	level: LogLevel,
	message: string,
	data?: Record<string, unknown>,
) {
	try {
		window.API_RENDERER?.logToMain(level, message, data);
	} catch {
		// IPC not available (e.g., during early init) -- silent fallback
	}
}

function serialize(args: unknown[]): Record<string, unknown> | undefined {
	if (args.length === 0) return undefined;
	if (args.length === 1 && args[0] instanceof Error) {
		return { err: args[0].message, stack: args[0].stack };
	}
	if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
		return args[0] as Record<string, unknown>;
	}
	return { detail: args.map((a) => (a instanceof Error ? a.message : a)) };
}

export const logger = {
	debug(message: string, ...args: unknown[]) {
		console.debug(message, ...args);
	},
	info(message: string, ...args: unknown[]) {
		console.info(message, ...args);
	},
	warn(message: string, ...args: unknown[]) {
		console.warn(message, ...args);
		forward("warn", message, serialize(args));
	},
	error(message: string, ...args: unknown[]) {
		console.error(message, ...args);
		forward("error", message, serialize(args));
	},
};
