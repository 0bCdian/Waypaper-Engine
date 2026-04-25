/** Lowercase extensions including leading dot — for dropped / picked paths. */
const VIDEO_FILE_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mkv",
  ".avi",
  ".mov",
]);

export function isVideoFilePath(filePath: string): boolean {
  const i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const base = (i >= 0 ? filePath.slice(i + 1) : filePath).toLowerCase();
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  return VIDEO_FILE_EXTENSIONS.has(ext);
}
