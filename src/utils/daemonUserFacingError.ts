import { useToastStore } from "../stores/toastStore";

export function daemonUserFacingMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === "string" && err.trim()) return err.trim();
  return "Something went wrong.";
}

function fileBasename(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return i >= 0 ? filePath.slice(i + 1) : filePath;
}

/** Extra guidance for strict waypaper.json / project.json import rules (daemon Web import). */
function webImportHint(coreMessage: string): string {
  const m = coreMessage.toLowerCase();
  if (
    m.includes("preview is required") ||
    m.includes("web preview file not found") ||
    m.includes("web manifest preview")
  ) {
    return ' In waypaper.json, set "preview" to a file that exists in the package (e.g. preview.gif or preview.png).';
  }
  if (
    m.includes("entry is required") ||
    m.includes("web entry file not found") ||
    m.includes("web manifest entry")
  ) {
    return ' In waypaper.json, set "entry" to your main HTML file (e.g. "index.html").';
  }
  if (m.includes("parse web manifest")) {
    return " Fix JSON syntax in waypaper.json and ensure the file is valid UTF-8.";
  }
  if (m.includes("no waypaper.json or project.json")) {
    return " Add waypaper.json (or project.json) at the package root.";
  }
  if (m.includes("read web manifest")) {
    return " Check file permissions and that waypaper.json is readable.";
  }
  return "";
}

export function formatWebWallpaperImportFailure(sourcePath: string, err: unknown): string {
  const name = fileBasename(sourcePath);
  const core = daemonUserFacingMessage(err);
  const hint = webImportHint(core);
  return hint
    ? `Web wallpaper import failed (${name}): ${core}.${hint}`
    : `Web wallpaper import failed (${name}): ${core}`;
}

export function notifyWebWallpaperImportFailed(sourcePath: string, err: unknown): void {
  useToastStore
    .getState()
    .addToast(formatWebWallpaperImportFailure(sourcePath, err), "error", 10_000);
}

export function notifyWallpaperApplyFailed(err: unknown): void {
  useToastStore
    .getState()
    .addToast(`Could not apply wallpaper: ${daemonUserFacingMessage(err)}`, "error", 8000);
}
