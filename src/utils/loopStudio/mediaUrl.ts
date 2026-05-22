/**
 * Path for `<video src>` in the Electron renderer.
 * Use `atom://` (registered in `electron/main.ts`) so local files work from the
 * Vite dev server (`http://`) origin; `file://` is blocked there.
 */
export function loopStudioMediaSrc(path: string): string {
  const p = path.trim();
  if (!p) return p;
  if (p.startsWith("atom://")) return p;
  if (p.startsWith("atom:")) {
    const rest = p.slice("atom:".length).replace(/^\/+/, "");
    return `atom://${rest}`;
  }
  if (p.startsWith("/")) return `atom://${p.slice(1)}`;
  if (/^[A-Za-z]:[\\/]/.test(p)) return `atom://${p.replace(/\\/g, "/")}`;
  return p;
}

/** Prefer browser-playable proxy (H.264) when the daemon generated one for the gallery row. */
export function loopStudioGalleryVideoSrc(img: {
  path: string;
  preview_path?: string | null;
}): string {
  const proxy = img.preview_path?.trim();
  if (proxy) return loopStudioMediaSrc(proxy);
  return loopStudioMediaSrc(img.path);
}
