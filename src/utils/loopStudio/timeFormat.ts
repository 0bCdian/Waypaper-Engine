/** Format seconds as `m:ss.sss` (loop-finder style). */
export function formatLoopTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function formatLoopTimeShort(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse `m:ss` or `m:ss.sss` into seconds. */
export function parseLoopTime(s: string): number {
  const m = (s + "").trim().match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!m) return Number.NaN;
  return +m[1] * 60 + +m[2] + (m[3] ? Number.parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0);
}
