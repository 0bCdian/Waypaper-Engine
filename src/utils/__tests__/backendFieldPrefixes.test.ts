import { describe, it, expect } from "vitest";
import { inferBackendSettingsSubTabFromSearchKey } from "../backendFieldPrefixes";

describe("inferBackendSettingsSubTabFromSearchKey", () => {
  it("maps top-level keys to general", () => {
    expect(inferBackendSettingsSubTabFromSearchKey("type")).toBe("general");
    expect(inferBackendSettingsSubTabFromSearchKey("_nav")).toBe("general");
  });

  it("maps prefixed keys to backend ids", () => {
    expect(inferBackendSettingsSubTabFromSearchKey("waylandutauri.transition")).toBe(
      "wayland-utauri",
    );
    expect(inferBackendSettingsSubTabFromSearchKey("awww.transition_type")).toBe("awww");
  });
});
