import { daemonClient } from "@/client";

function normalizeFsPath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

/** Wait until POST /images batch created a video row for this source path (async import). */
export async function waitForGalleryVideoBySourcePath(
  sourcePath: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<number | null> {
  const maxAttempts = options?.maxAttempts ?? 50;
  const intervalMs = options?.intervalMs ?? 200;
  const want = normalizeFsPath(sourcePath);
  if (!want) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // oxlint-disable-next-line react-doctor/async-await-in-loop -- ordered: polling loop — must check then sleep then re-check sequentially
    const res = await daemonClient.getImages({
      media_type: "video",
      sort_by: "imported_at",
      sort_order: "desc",
      per_page: 80,
    });
    // oxlint-disable-next-line react-doctor/js-index-maps -- res.data is freshly fetched each poll iteration; can't pre-index outside the loop
    const hit = res.data.find((im) => {
      if (im.media_type !== "video") return false;
      const sp = normalizeFsPath(im.source_path ?? "");
      const cp = normalizeFsPath(im.path ?? "");
      return sp === want || cp === want;
    });
    if (hit) return hit.id;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
