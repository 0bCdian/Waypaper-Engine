/**
 * Electron UI Test Fixtures
 *
 * Launches a real Electron window connected to a test daemon.
 * Reuses daemon lifecycle helpers from the main e2e fixtures.
 */

import { test as base, _electron, type ElectronApplication, type Page } from "@playwright/test";
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

interface DaemonContext {
	process: ChildProcess;
	socketPath: string;
	configPath: string;
	dataDir: string;
	imagesDir: string;
}

function httpRequestJSON(
	socketPath: string,
	method: string,
	path: string,
): Promise<{ status: number; data: unknown }> {
	return new Promise((resolve, reject) => {
		const req = httpRequest(
			{ socketPath, path, method, headers: { Accept: "application/json" } },
			(res) => {
				let data = "";
				res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
				res.on("end", () => {
					try {
						resolve({ status: res.statusCode ?? 0, data: data ? JSON.parse(data) : null });
					} catch {
						resolve({ status: res.statusCode ?? 0, data });
					}
				});
			},
		);
		req.on("error", reject);
		req.setTimeout(10_000, () => { req.destroy(); reject(new Error(`HTTP timeout: ${method} ${path}`)); });
		req.end();
	});
}

async function waitForDaemon(socketPath: string, timeoutMs = 15_000): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await httpRequestJSON(socketPath, "GET", "/healthz");
			if (res.status === 200 && (res.data as { status: string })?.status === "ok") return;
		} catch { /* not ready */ }
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
	const dataDir = mkdtempSync(join(tmpdir(), "waypaper-ui-e2e-"));
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
	writeFileSync(configPath, `[app]
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
`);

	const proc = spawn(
		binaryPath,
		["start", "--config", configPath, "--lock-path", lockPath],
		{ stdio: "pipe", env: { ...process.env } },
	);

	return { process: proc, socketPath, configPath, dataDir, imagesDir };
}

function stopDaemon(ctx: DaemonContext) {
	if (ctx.process && !ctx.process.killed) {
		ctx.process.kill("SIGTERM");
	}
	try {
		rmSync(ctx.dataDir, { recursive: true, force: true });
	} catch { /* best effort */ }
}

function buildElectronApp() {
	const mainJs = join(ROOT, "dist-electron", "main.js");
	if (!existsSync(mainJs)) {
		execSync("npx vite build", { cwd: ROOT, stdio: "pipe" });
	}
	return mainJs;
}

export type UIFixtures = {
	electronApp: ElectronApplication;
	page: Page;
};

export const test = base.extend<UIFixtures>({
	electronApp: async ({}, use) => {
		const binaryPath = buildDaemon();
		const daemonCtx = startDaemon(binaryPath);
		await waitForDaemon(daemonCtx.socketPath);

		const mainJs = buildElectronApp();
		const electronBin = join(ROOT, "node_modules", "electron", "dist", "electron");
		const electronApp = await _electron.launch({
			executablePath: electronBin,
			args: [mainJs],
			env: {
				...process.env,
				WAYPAPER_SOCKET: daemonCtx.socketPath,
				WAYPAPER_CONFIG: daemonCtx.configPath,
				NODE_ENV: "development",
			},
		});

		await use(electronApp);

		await electronApp.close();
		stopDaemon(daemonCtx);
	},

	page: async ({ electronApp }, use) => {
		const page = await electronApp.firstWindow();
		await page.waitForLoadState("domcontentloaded");
		await use(page);
	},
});

export { expect } from "@playwright/test";
