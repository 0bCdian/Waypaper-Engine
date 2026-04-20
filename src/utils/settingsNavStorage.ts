import type { ConfigSection } from "@/shared/types/unifiedConfig";

export const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "waypaper-settings-active-section";

/** Sections exposed in the settings sidebar / tabs (subset of ConfigSection). */
export const SETTINGS_NAV_SECTION_IDS = ["app", "daemon", "backend", "wallhaven"] as const;

export type SettingsNavSectionId = (typeof SETTINGS_NAV_SECTION_IDS)[number];

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
