import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mkv", ".avi", ".mov"]);

const WEB_MANIFEST_NAMES = new Set(["waypaper.json", "project.json"]);

export interface ScanDirectoryForImportsResult {
  mediaFiles: string[];
  webPackageRoots: string[];
}

function fileExtLower(entry: string): string {
  const dot = entry.lastIndexOf(".");
  if (dot < 0) return "";
  return entry.slice(dot).toLowerCase();
}

/**
 * Recursively scans dirPath for image/video files and web wallpaper package roots
 * (directories that directly contain waypaper.json or project.json). Files inside
 * a web package directory are not collected as standalone media.
 */
export async function scanDirectoryForImports(dirPath: string): Promise<ScanDirectoryForImportsResult> {
  const mediaFiles: string[] = [];
  const webPackageRoots: string[] = [];

  async function scan(currentPath: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(currentPath);
    } catch {
      return;
    }

    const hasWebManifest = entries.some((e) => WEB_MANIFEST_NAMES.has(e.toLowerCase()));
    if (hasWebManifest) {
      webPackageRoots.push(currentPath);
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      let stats;
      try {
        stats = await stat(fullPath);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        await scan(fullPath);
      } else if (stats.isFile()) {
        const ext = fileExtLower(entry);
        if (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
          mediaFiles.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return { mediaFiles, webPackageRoots };
}
