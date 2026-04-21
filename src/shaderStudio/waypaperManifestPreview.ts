/**
 * Inject `preview` into an existing waypaper.json string (pretty-printed, trailing newline).
 */
export function addPreviewToWaypaperJsonString(json: string, previewRel: string): string {
  const obj = JSON.parse(json) as Record<string, unknown>;
  obj.preview = previewRel;
  return JSON.stringify(obj, null, 2) + "\n";
}
