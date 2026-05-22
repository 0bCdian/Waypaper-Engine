/**
 * Parse JSON bodies from daemon HTTP responses. Defensive against stray leading
 * bytes gluing SSE fragments / parser quirks to REST bodies (e.g. true{"status":"reset"}).
 */
export function parseDaemonJsonBody(trimmed: string): unknown {
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const braceIdx = trimmed.indexOf("{");
    const bracketIdx = trimmed.indexOf("[");
    let start = -1;
    if (braceIdx >= 0 && (bracketIdx < 0 || braceIdx <= bracketIdx)) {
      start = braceIdx;
    } else if (bracketIdx >= 0) {
      start = bracketIdx;
    }
    if (start > 0) {
      try {
        return JSON.parse(trimmed.slice(start));
      } catch {
        // fall through — surface original failure
      }
    }
    throw err;
  }
}
