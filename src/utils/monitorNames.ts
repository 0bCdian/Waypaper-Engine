/**
 * Legacy wayland-utauri topology stable_id format from waypaper-tauri
 * (`monitor:{id}:{x}:{y}:{w}:{h}`). Daemon/UI now use `Monitor {id}` labels.
 */
const LEGACY_UTAURI_STABLE_RE = /^monitor:(\d+):/;

export function normalizeLegacyWaylandUtauriMonitorName(name: string): string {
  const m = name.match(LEGACY_UTAURI_STABLE_RE);
  if (m) return `Monitor ${m[1]}`;
  return name;
}

/** Normalize each name and drop duplicates (first occurrence wins). */
export function normalizeSelectedMonitors(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const norm = normalizeLegacyWaylandUtauriMonitorName(n);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

export function selectedMonitorsOrderChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}
