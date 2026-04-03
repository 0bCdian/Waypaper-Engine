import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect } from "vitest";
import { scanDirectoryForImports } from "./scanDirectoryForImports";

describe("scanDirectoryForImports", () => {
  it("collects loose media and skips files inside web package dirs", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "wp-scan-"));

    await writeFile(join(tmp, "a.png"), Buffer.from("x"));
    const pkg = join(tmp, "wallpkg");
    await mkdir(pkg, { recursive: true });
    await writeFile(join(pkg, "waypaper.json"), Buffer.from("{}"), "utf8");
    await writeFile(join(pkg, "index.html"), Buffer.from("<html/>"), "utf8");
    await writeFile(join(pkg, "noise.jpg"), Buffer.from("x"));

    const { mediaFiles, webPackageRoots } = await scanDirectoryForImports(tmp);

    expect(webPackageRoots).toEqual([pkg]);
    expect(mediaFiles).toEqual([join(tmp, "a.png")]);
    expect(mediaFiles.some((p) => p.includes("noise.jpg"))).toBe(false);
  });
});
