import openImagesStore from "../hooks/useOpenImages";
import { useFoldersStore } from "../stores/foldersStore";
import { notifyWebWallpaperImportFailed } from "./daemonUserFacingError";
import { logger } from "./logger";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".tiff",
  ".tif",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mkv", ".avi", ".mov"]);

export function fileBasename(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return i >= 0 ? filePath.slice(i + 1) : filePath;
}

export type DroppedFileClassification = {
  mediaPaths: string[];
  manifestPaths: string[];
  shadertoyPaths: string[];
  otherPaths: string[];
};

export function classifyDroppedPath(filePath: string): {
  kind: "media" | "manifest" | "shadertoy" | "other";
} {
  const base = fileBasename(filePath).toLowerCase();
  if (base === "waypaper.json" || base === "project.json") return { kind: "manifest" };
  const dot = filePath.lastIndexOf(".");
  const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : "";
  if (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) return { kind: "media" };
  if (ext === ".json") return { kind: "shadertoy" };
  return { kind: "other" };
}

export function collectDroppedPaths(
  e: React.DragEvent,
): DroppedFileClassification & { urls: string[] } {
  const files = e.dataTransfer.files;
  const uriList = e.dataTransfer.getData("text/uri-list");
  const textPlain = e.dataTransfer.getData("text/plain");

  const mediaPaths: string[] = [];
  const manifestPaths: string[] = [];
  const shadertoyPaths: string[] = [];
  const otherPaths: string[] = [];

  function addPath(filePath: string) {
    const { kind } = classifyDroppedPath(filePath);
    if (kind === "media") mediaPaths.push(filePath);
    else if (kind === "manifest") manifestPaths.push(filePath);
    else if (kind === "shadertoy") shadertoyPaths.push(filePath);
    else otherPaths.push(filePath);
  }

  for (let i = 0; i < (files?.length ?? 0); i++) {
    const file = files[i];
    let filePath: string | undefined;
    try {
      filePath = window.API_RENDERER.getPathForFile(file);
    } catch {
      /* not available */
    }
    if (filePath) addPath(filePath);
  }

  // Fallback for Linux file managers (Nautilus/GTK) that deliver dropped files
  // as file:// URIs instead of populating dataTransfer.files.
  if (
    mediaPaths.length === 0 &&
    manifestPaths.length === 0 &&
    shadertoyPaths.length === 0 &&
    otherPaths.length === 0
  ) {
    const rawUri = uriList || textPlain || "";
    const fileUris = rawUri
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("file://"));
    for (const uri of fileUris) {
      addPath(decodeURIComponent(uri.replace(/^file:\/\//, "")));
    }
  }

  const rawUrl = uriList || textPlain || "";
  const urls = rawUrl
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

  return { mediaPaths, manifestPaths, shadertoyPaths, otherPaths, urls };
}

export async function importMediaDrop(
  mediaPaths: string[],
  manifestPaths: string[],
  otherPaths: string[],
): Promise<void> {
  const folderId = useFoldersStore.getState().currentFolderId ?? undefined;
  if (manifestPaths.length > 0) {
    for (const p of manifestPaths) {
      void window.API_RENDERER.goDaemon.importWebWallpaper(p, folderId).catch((err) => {
        logger.error("Web wallpaper import failed:", p, err);
        notifyWebWallpaperImportFailed(p, err);
      });
    }
  }
  if (mediaPaths.length > 0) {
    await window.API_RENDERER.goDaemon.importImages(mediaPaths);
  }
  if (otherPaths.length > 0) {
    for (const p of otherPaths) {
      void openImagesStore.getState().importDroppedDirectory(p);
    }
  }
}

export async function downloadAndImportUrls(urls: string[]): Promise<void> {
  const downloadedPaths: string[] = [];
  for (const url of urls) {
    try {
      const tmpPath = await window.API_RENDERER.downloadUrl(url);
      downloadedPaths.push(tmpPath);
    } catch (err) {
      logger.error("Failed to download URL:", url, err);
    }
  }
  if (downloadedPaths.length > 0) {
    await window.API_RENDERER.goDaemon.importImages(downloadedPaths);
  }
}
