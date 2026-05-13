import { describe, it, expect, beforeEach } from "vitest";
import {
  SETTINGS_BACKEND_PANEL_STORAGE_KEY,
  readPersistedBackendSettingsPanel,
  writePersistedBackendSettingsPanel,
} from "../settingsNavStorage";

describe("settingsNavStorage backend panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when unset", () => {
    expect(readPersistedBackendSettingsPanel()).toBeNull();
  });

  it("round-trips general", () => {
    writePersistedBackendSettingsPanel("general");
    expect(readPersistedBackendSettingsPanel()).toBe("general");
    expect(localStorage.getItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY)).toBe("general");
  });

  it("round-trips backend ids with hyphen", () => {
    writePersistedBackendSettingsPanel("wal-qt");
    expect(readPersistedBackendSettingsPanel()).toBe("wal-qt");
  });

  it("rejects invalid persisted values", () => {
    localStorage.setItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY, "../../evil");
    expect(readPersistedBackendSettingsPanel()).toBeNull();
  });

  it("does not write invalid panel ids", () => {
    writePersistedBackendSettingsPanel("../../x");
    expect(localStorage.getItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY)).toBeNull();
  });
});
