/** Drop duplicates from a list of monitor names (first occurrence wins). */
export function normalizeSelectedMonitors(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function selectedMonitorsOrderChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}
