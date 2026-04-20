/**
 * E2E Test Fixtures
 *
 * Tests the daemon REST API directly over its Unix socket.
 * Each test gets a fresh daemon instance with isolated data directories.
 */

import { test as base } from "@playwright/test";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import {
	mkdtempSync,
	writeFileSync,
	mkdirSync,
	existsSync,
	rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";

const ROOT = join(__dirname, "..");

export interface DaemonContext {
	process: ChildProcess;
	socketPath: string;
	dataDir: string;
	imagesDir: string;
}

function httpRequestJSON(
	socketPath: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<{ status: number; data: unknown }> {
	return new Promise((resolve, reject) => {
		const bodyStr = body ? JSON.stringify(body) : undefined;
		const req = httpRequest(
			{
				socketPath,
				path,
				method,
				headers: {
					Accept: "application/json",
					...(bodyStr
						? {
								"Content-Type": "application/json",
								"Content-Length": Buffer.byteLength(bodyStr),
							}
						: {}),
				},
			},
			(res) => {
				let data = "";
				res.on("data", (chunk: Buffer) => {
					data += chunk.toString();
				});
				res.on("end", () => {
					try {
						const parsed = data ? JSON.parse(data) : null;
						resolve({ status: res.statusCode ?? 0, data: parsed });
					} catch {
						resolve({ status: res.statusCode ?? 0, data });
					}
				});
			},
		);
		req.on("error", reject);
		req.setTimeout(10_000, () => {
			req.destroy();
			reject(new Error(`HTTP timeout: ${method} ${path}`));
		});
		if (bodyStr) req.write(bodyStr);
		req.end();
	});
}

async function waitForDaemon(
	socketPath: string,
	timeoutMs = 15_000,
): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await httpRequestJSON(socketPath, "GET", "/healthz");
			if (
				res.status === 200 &&
				(res.data as { status: string })?.status === "ok"
			) {
				return;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Daemon did not become ready within ${timeoutMs}ms`);
}

function buildDaemon(): string {
	const binaryPath = join(ROOT, "daemon", "build", "waypaper-daemon");
	if (!existsSync(binaryPath)) {
		execSync(
			"mkdir -p daemon/build && cd daemon && go build -ldflags \"-s -w\" -o build/waypaper-daemon ./cmd/daemon",
			{ cwd: ROOT, stdio: "pipe" },
		);
	}
	return binaryPath;
}

function startDaemon(binaryPath: string): DaemonContext {
	const dataDir = mkdtempSync(join(tmpdir(), "waypaper-e2e-"));
	const socketPath = join(dataDir, "waypaper-engine.sock");
	const lockPath = join(dataDir, "daemon.pid");
	const configDir = join(dataDir, "config");
	const imagesDir = join(dataDir, "images");
	const thumbsDir = join(dataDir, "thumbnails");
	const dbDir = join(dataDir, "db");

	mkdirSync(configDir, { recursive: true });
	mkdirSync(imagesDir, { recursive: true });
	mkdirSync(thumbsDir, { recursive: true });
	mkdirSync(dbDir, { recursive: true });

	const configPath = join(configDir, "config.toml");
	writeFileSync(
		configPath,
		`[app]
kill_daemon_on_exit = false
notifications = false
start_minimized = false
minimize_instead_of_close = false
show_monitor_modal_on_start = false
images_per_page = 50
theme = "kolision-raw"
font_preset = "bundled"
font_family_body = ""
font_family_display = ""
font_family_mono = ""
image_history_limit = 100
sort_by = "imported_at"
sort_order = "desc"

[daemon]
images_dir = "${imagesDir}"
thumbnails_dir = "${thumbsDir}"
database_dir = "${dbDir}"
socket_path = "${socketPath}"
log_level = "warn"
log_file = "${join(dataDir, "daemon.log")}"
log_max_size_mb = 5
log_max_backups = 1
compositor = "auto"

[backend]
type = "awww"

[monitors]
selected_monitors = []
image_set_type = "individual"
`,
	);

	const proc = spawn(
		binaryPath,
		["start", "--config", configPath, "--lock-path", lockPath],
		{ stdio: "pipe", env: { ...process.env } },
	);

	return { process: proc, socketPath, dataDir, imagesDir };
}

function stopDaemon(ctx: DaemonContext) {
	if (ctx.process && !ctx.process.killed) {
		ctx.process.kill("SIGTERM");
	}
	try {
		rmSync(ctx.dataDir, { recursive: true, force: true });
	} catch {
		// best effort cleanup
	}
}

export type TestFixtures = {
	daemon: DaemonContext;
	api: {
		get: (path: string) => Promise<{ status: number; data: unknown }>;
		post: (
			path: string,
			body?: unknown,
		) => Promise<{ status: number; data: unknown }>;
		patch: (
			path: string,
			body?: unknown,
		) => Promise<{ status: number; data: unknown }>;
		del: (path: string, body?: unknown) => Promise<{ status: number; data: unknown }>;
	};
};

export const test = base.extend<TestFixtures>({
	daemon: async ({}, use) => {
		const binaryPath = buildDaemon();
		const ctx = startDaemon(binaryPath);
		await waitForDaemon(ctx.socketPath);
		await use(ctx);
		stopDaemon(ctx);
	},

	api: async ({ daemon }, use) => {
		const sock = daemon.socketPath;
		await use({
			get: (path) => httpRequestJSON(sock, "GET", path),
			post: (path, body) => httpRequestJSON(sock, "POST", path, body),
			patch: (path, body) => httpRequestJSON(sock, "PATCH", path, body),
			del: (path, body?) => httpRequestJSON(sock, "DELETE", path, body),
		});
	},
});

export { expect } from "@playwright/test";
