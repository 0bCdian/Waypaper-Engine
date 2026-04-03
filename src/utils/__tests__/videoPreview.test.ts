import { describe, expect, it, vi } from "vitest";
import { playMutedVideoWhenReady } from "../videoPreview";

describe("playMutedVideoWhenReady", () => {
  it("calls play immediately when readyState is high enough", () => {
    const video = {
      muted: false,
      readyState: HTMLMediaElement.HAVE_FUTURE_DATA,
      play: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;

    const cancel = playMutedVideoWhenReady(video);
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.addEventListener).not.toHaveBeenCalled();
    cancel();
  });

  it("subscribes to canplay when not ready and cancel skips play", () => {
    const addEventListener = vi.fn();
    const video = {
      muted: false,
      readyState: HTMLMediaElement.HAVE_NOTHING,
      play: vi.fn().mockResolvedValue(undefined),
      addEventListener,
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;

    const cancel = playMutedVideoWhenReady(video);
    expect(addEventListener).toHaveBeenCalledWith("canplay", expect.any(Function), {
      once: true,
    });
    expect(addEventListener).toHaveBeenCalledWith("loadeddata", expect.any(Function), {
      once: true,
    });
    cancel();
    const handler = addEventListener.mock.calls[0][1] as () => void;
    handler();
    expect(video.play).not.toHaveBeenCalled();
  });
});
