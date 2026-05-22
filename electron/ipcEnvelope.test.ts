import { describe, expect, it } from "vitest";
import { ensureDaemonActionSuccess, unwrapIPCResponse } from "./ipcEnvelope";

describe("unwrapIPCResponse", () => {
  it("returns inner data when response is successful", () => {
    const out = unwrapIPCResponse<{ ok: boolean }>("test-channel", {
      success: true,
      data: { ok: true },
    });
    expect(out).toEqual({ ok: true });
  });

  it("throws when wrapped response is unsuccessful", () => {
    expect(() => unwrapIPCResponse("test-channel", { success: false, error: "failed" })).toThrow(
      "failed",
    );
  });
});

describe("ensureDaemonActionSuccess", () => {
  it("does not throw when daemon action reports success", () => {
    expect(() => ensureDaemonActionSuccess("restart-daemon", { success: true })).not.toThrow();
  });

  it("throws when daemon action reports nested failure", () => {
    expect(() =>
      ensureDaemonActionSuccess("restart-daemon", {
        success: false,
        error: "daemon failed",
      }),
    ).toThrow("daemon failed");
  });
});
