/**
 * Start muted gallery preview playback. With light preload, play() often rejects until
 * enough media is buffered; we wait for canplay once.
 * @returns cancel — call on pointer leave so a late canplay does not start playback.
 */
export function playMutedVideoWhenReady(
  video: HTMLVideoElement,
  onPlayRejected?: (err: unknown) => void,
): () => void {
  video.muted = true;
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    void video.play().catch((err) => {
      onPlayRejected?.(err);
      /* codec / atom:// / policy: keep console clean */
    });
  };
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    run();
    return () => {
      cancelled = true;
    };
  }
  const onReady = () => {
    video.removeEventListener("canplay", onReady);
    video.removeEventListener("loadeddata", onReady);
    run();
  };
  video.addEventListener("canplay", onReady, { once: true });
  video.addEventListener("loadeddata", onReady, { once: true });
  return () => {
    cancelled = true;
    video.removeEventListener("canplay", onReady);
    video.removeEventListener("loadeddata", onReady);
  };
}
