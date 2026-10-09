/** Polls `check` every `intervalMs` until it resolves; rejects with its last error after `deadlineMs`. */
export async function waitUntilHealthy<T>(
  check: () => Promise<T>,
  { intervalMs = 50, deadlineMs = 10_000 }: { intervalMs?: number; deadlineMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    try {
      // oxlint-disable-next-line react-doctor/async-await-in-loop -- polling: each attempt must finish before the next
      return await check();
    } catch (error) {
      if (Date.now() + intervalMs > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
