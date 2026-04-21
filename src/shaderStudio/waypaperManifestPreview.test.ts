import { describe, expect, it } from "vitest";
import { addPreviewToWaypaperJsonString } from "./waypaperManifestPreview";

describe("addPreviewToWaypaperJsonString", () => {
  it("adds preview field", () => {
    const out = addPreviewToWaypaperJsonString(`{"waypaper":"1","title":"T"}\n`, "preview.webp");
    const m = JSON.parse(out) as { preview: string; title: string };
    expect(m.preview).toBe("preview.webp");
    expect(m.title).toBe("T");
  });
});
