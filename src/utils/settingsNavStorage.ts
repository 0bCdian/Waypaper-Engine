import type { ConfigSection } from "@/shared/types/unifiedConfig";

export const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "waypaper-settings-active-section";

/** Inner Backend settings panel: `"general"` or a backend id (e.g. awww). */
export const SETTINGS_BACKEND_PANEL_STORAGE_KEY = "waypaper-settings-backend-panel";

/** Sections exposed in the settings sidebar / tabs (subset of ConfigSection). */
export const SETTINGS_NAV_SECTION_IDS = ["app", "daemon", "backend", "wallhaven"] as const;

type SettingsNavSectionId = (typeof SETTINGS_NAV_SECTION_IDS)[number];

function isSettingsNavSectionId(value: string): value is SettingsNavSectionId {
  return (SETTINGS_NAV_SECTION_IDS as readonly string[]).includes(value);
}

export function readPersistedSettingsSection(): ConfigSection | null {
  try {
    const raw = localStorage.getItem(SETTINGS_ACTIVE_SECTION_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    if (!isSettingsNavSectionId(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function writePersistedSettingsSection(section: ConfigSection): void {
  if (!isSettingsNavSectionId(section)) return;
  try {
    localStorage.setItem(SETTINGS_ACTIVE_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Matches daemon-reported backend names (letters, digits, hyphen, dot, underscore). */
function isPersistableBackendPanelId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[\w.-]+$/.test(value);
}

/** `"general"` or a backend id string suitable for comparing with `getBackends()` names. */
export function readPersistedBackendSettingsPanel(): string | null {
  try {
    const raw = localStorage.getItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    if (trimmed === "general") return "general";
    if (!isPersistableBackendPanelId(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function writePersistedBackendSettingsPanel(panel: string): void {
  const trimmed = panel.trim();
  if (trimmed === "general") {
    try {
      localStorage.setItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY, "general");
    } catch {
      /* ignore quota / private mode */
    }
    return;
  }
  if (!isPersistableBackendPanelId(trimmed)) return;
  try {
    localStorage.setItem(SETTINGS_BACKEND_PANEL_STORAGE_KEY, trimmed);
  } catch {
    /* ignore quota / private mode */
  }
}
