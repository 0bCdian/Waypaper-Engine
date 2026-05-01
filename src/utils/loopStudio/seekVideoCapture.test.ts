import { describe, expect, it, vi } from "vitest";
import { waitUntilVideoCanSample } from "./seekVideoCapture";

describe("waitUntilVideoCanSample", () => {
  it("resolves true when already HAVE_CURRENT_DATA with dimensions", async () => {
    const vs = document.createElement("video");
    Object.defineProperty(vs, "readyState", { value: 4, configurable: true });
    Object.defineProperty(vs, "videoWidth", {
      value: 1280,
      configurable: true,
    });
    Object.defineProperty(vs, "videoHeight", {
      value: 720,
      configurable: true,
    });
    await expect(waitUntilVideoCanSample(vs, 50)).resolves.toBe(true);
  });

  it("resolves false when metadata never arrives", async () => {
    vi.useFakeTimers();
    const vs = document.createElement("video");
    Object.defineProperty(vs, "readyState", { value: 0, configurable: true });
    Object.defineProperty(vs, "videoWidth", { value: 0, configurable: true });
    Object.defineProperty(vs, "videoHeight", { value: 0, configurable: true });
    const p = waitUntilVideoCanSample(vs, 200);
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe(false);
    vi.useRealTimers();
  });
});
