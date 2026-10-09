// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { waitUntilHealthy } from "../waitUntilHealthy";

describe("waitUntilHealthy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves within one interval of the check starting to pass", async () => {
    let healthyAt = 230;
    const check = vi.fn(async () => {
      if (Date.now() < healthyAt) throw new Error("ECONNREFUSED");
      return "ok";
    });
    healthyAt += Date.now();

    const result = waitUntilHealthy(check, { intervalMs: 50, deadlineMs: 10_000 });
    await vi.advanceTimersByTimeAsync(280);

    await expect(result).resolves.toBe("ok");
  });

  it("rejects with the last error once the deadline passes", async () => {
    const check = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = waitUntilHealthy(check, { intervalMs: 50, deadlineMs: 500 });
    const assertion = expect(result).rejects.toThrow("ECONNREFUSED");
    await vi.advanceTimersByTimeAsync(600);

    await assertion;
    expect(check.mock.calls.length).toBeGreaterThanOrEqual(9);
  });
});
