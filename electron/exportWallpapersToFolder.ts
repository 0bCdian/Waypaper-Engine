import { copyFile, cp, mkdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

/** Renderer `atom://` paths → absolute filesystem paths. */
export function atomPathToFs(p: string): string {
  if (!p?.trim()) return p;
  if (p.startsWith("atom://")) return `/${p.slice("atom://".length)}`;
  return p;
}

/** One segment for a file or directory under the export folder. */
export function sanitizeExportBaseName(name: string): string {
  const s = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.+$/, "")
    .replace(/^\.+/, "");
  if (!s) return "wallpaper";
  return s.slice(0, 200);
}

/** Reserves a unique key in `used` (lowercase full name) and returns the chosen basename (no path). */
export function uniqueExportName(used: Set<string>, base: string, extWithDot: string): string {
  const ext = extWithDot && !extWithDot.startsWith(".") ? `.${extWithDot}` : extWithDot;
  const stem = sanitizeExportBaseName(base);
  let n = 0;
  for (;;) {
    const name = n === 0 ? stem : `${stem}_${n + 1}`;
    const full = `${name}${ext}`;
    const key = full.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return full;
    }
    n += 1;
  }
}

export type ExportWallpaperPayload = {
  id: number;
  name: string;
  path: string;
  media_type: string;
  package_root?: string | null;
};

export async function exportWallpapersToDirectory(
  destDir: string,
  items: ExportWallpaperPayload[],
): Promise<{ exported: number; failed: number }> {
  await mkdir(destDir, { recursive: true });
  const usedNames = new Set<string>();
  let exported = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const media = (item.media_type || "image").toLowerCase();
      const isWeb = media === "web" && item.package_root?.trim();

      if (isWeb) {
        const rootFs = atomPathToFs(item.package_root!.trim());
        // oxlint-disable-next-line react-doctor/async-await-in-loop -- ordered: each iteration mutates shared `usedNames` Set for unique filename allocation; parallelizing would race on name collisions
        await stat(rootFs);
        const dirName = uniqueExportName(usedNames, item.name, "");
        await cp(rootFs, join(destDir, dirName), { recursive: true });
        exported += 1;
      } else {
        const srcFs = atomPathToFs(item.path);
        await stat(srcFs);
        const ext = extname(srcFs) || "";
        const stem = basename(srcFs, ext) || sanitizeExportBaseName(item.name);
        const fileName = uniqueExportName(usedNames, stem, ext);
        await copyFile(srcFs, join(destDir, fileName));
        exported += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { exported, failed };
}
