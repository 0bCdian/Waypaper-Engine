/**
 * Legacy persisted stable_id strings from older wayland-utauri builds
 * (`monitor:{id}:{x}:{y}:{w}:{h}`). Current daemons use compositor output names
 * (`HDMI-A-1`, …); this maps old rows to the synthetic `Monitor {id}` label so
 * UI code can still dedupe. Re-select monitors in settings if names no longer
 * match the live list.
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
