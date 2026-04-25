import { useToastStore } from "../stores/toastStore";

function daemonUserFacingMessage(err: unknown): string {
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
  if (m.includes("web preview file not found")) {
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

function formatWebWallpaperImportFailure(sourcePath: string, err: unknown): string {
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

interface DaemonError extends Error {
  errorCode?: string;
  meta?: Record<string, unknown>;
}

function formatIncompatibleBackend(err: DaemonError): string {
  const backend = (err.meta?.backend as string) ?? "current backend";
  const mediaType = (err.meta?.media_type as string) ?? "this media";
  const imageName = err.meta?.image_name as string | undefined;
  const target = imageName ? `"${imageName}"` : "this wallpaper";
  return `Cannot set ${target}: ${backend} does not support ${mediaType} wallpapers.`;
}

export function notifyWallpaperApplyFailed(err: unknown): void {
  const de = err as DaemonError | undefined;
  const message =
    de?.errorCode === "incompatible_backend"
      ? formatIncompatibleBackend(de)
      : `Could not apply wallpaper: ${daemonUserFacingMessage(err)}`;
  useToastStore.getState().addToast(message, "error", 8000);
}
