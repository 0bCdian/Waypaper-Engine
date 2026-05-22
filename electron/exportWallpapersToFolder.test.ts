// @vitest-environment node
import { describe, expect, it } from "vitest";
import { atomPathToFs, sanitizeExportBaseName, uniqueExportName } from "./exportWallpapersToFolder";

describe("atomPathToFs", () => {
  it("strips atom protocol for absolute unix path", () => {
    expect(atomPathToFs("atom://home/user/file.png")).toBe("/home/user/file.png");
  });

  it("leaves plain paths unchanged", () => {
    expect(atomPathToFs("/tmp/x")).toBe("/tmp/x");
  });
});

describe("sanitizeExportBaseName", () => {
  it("replaces invalid characters", () => {
    expect(sanitizeExportBaseName('a<b>c:d"e')).toBe("a_b_c_d_e");
  });

  it("uses fallback for empty", () => {
    expect(sanitizeExportBaseName("   ")).toBe("wallpaper");
  });
});

describe("uniqueExportName", () => {
  it("dedupes with numeric suffix", () => {
    const used = new Set<string>();
    expect(uniqueExportName(used, "shot", ".png")).toBe("shot.png");
    expect(uniqueExportName(used, "shot", ".png")).toBe("shot_2.png");
    expect(uniqueExportName(used, "shot", ".png")).toBe("shot_3.png");
  });

  it("handles empty extension for directory-style names", () => {
    const used = new Set<string>();
    expect(uniqueExportName(used, "pkg", "")).toBe("pkg");
    expect(uniqueExportName(used, "pkg", "")).toBe("pkg_2");
  });
});
