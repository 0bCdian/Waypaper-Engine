import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";

// Desktop launchers often start Electron with a minimal PATH, so also probe the usual install dirs.
const FALLBACK_DIRS = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"];

export async function findBinary(name: string): Promise<string> {
  const dirs = [...(process.env.PATH ?? "").split(delimiter), ...FALLBACK_DIRS];
  for (const dir of dirs.filter(Boolean)) {
    const candidate = join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return "";
}
