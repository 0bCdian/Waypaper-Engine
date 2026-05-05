import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/client", () => ({
  daemonClient: {
    getImages: vi.fn(),
  },
}));

import { daemonClient } from "@/client";
import {
  findGalleryVideoIdBySourcePath,
  waitForGalleryVideoBySourcePath,
} from "../waitGalleryImport";

describe("findGalleryVideoIdBySourcePath", () => {
  beforeEach(() => {
    vi.mocked(daemonClient.getImages).mockReset();
  });

  it("returns id when path matches source_path on first page", async () => {
    vi.mocked(daemonClient.getImages).mockResolvedValue({
      data: [
        {
          id: 7,
          media_type: "video",
          source_path: "/tmp/clip.mp4",
          path: "/g/a.mp4",
        } as any,
      ],
      pagination: { page: 1, per_page: 80, total_items: 1, total_pages: 1 },
    });
    await expect(findGalleryVideoIdBySourcePath("/tmp/clip.mp4")).resolves.toBe(7);
    expect(daemonClient.getImages).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, media_type: "video" }),
    );
  });

  it("returns null when no row matches", async () => {
    vi.mocked(daemonClient.getImages).mockResolvedValue({
      data: [
        {
          id: 1,
          media_type: "video",
          source_path: "/other/a.mp4",
          path: "/g/a.mp4",
        } as any,
      ],
      pagination: { page: 1, per_page: 80, total_items: 1, total_pages: 1 },
    });
    await expect(findGalleryVideoIdBySourcePath("/tmp/nope.mp4")).resolves.toBeNull();
  });
});

describe("waitForGalleryVideoBySourcePath", () => {
  beforeEach(() => {
    vi.mocked(daemonClient.getImages).mockReset();
  });

  it("stops after maxAttempts and returns null", async () => {
    vi.mocked(daemonClient.getImages).mockResolvedValue({
      data: [],
      pagination: { page: 1, per_page: 80, total_items: 0, total_pages: 0 },
    });
    await expect(
      waitForGalleryVideoBySourcePath("/mnt/walls/a.mp4", { maxAttempts: 4, intervalMs: 1 }),
    ).resolves.toBeNull();
    expect(daemonClient.getImages).toHaveBeenCalledTimes(4);
  });

  it("matches video row when source_path differs only by duplicate slashes", async () => {
    vi.mocked(daemonClient.getImages)
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, per_page: 80, total_items: 0, total_pages: 0 },
      })
      .mockResolvedValue({
        data: [
          {
            id: 42,
            media_type: "video",
            source_path: "/home/user//clips//a.mp4",
            path: "/data/gallery/a-1.mp4",
          } as any,
        ],
        pagination: { page: 1, per_page: 80, total_items: 1, total_pages: 1 },
      });
    await expect(
      waitForGalleryVideoBySourcePath("/home/user/clips/a.mp4", { maxAttempts: 5, intervalMs: 1 }),
    ).resolves.toBe(42);
  });
});
