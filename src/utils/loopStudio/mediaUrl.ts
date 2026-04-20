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
