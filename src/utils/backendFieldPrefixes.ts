/**
 * Config field key prefixes in unified config vs daemon backend id (tabs in Backend settings).
 * Keep in sync with BackendSettingsSection patchKeyForField / getBackendSubconfig.
 */
export const FIELD_PREFIX_BY_BACKEND: Record<string, string> = {
  awww: "awww.",
  feh: "feh.",
  hyprpaper: "hyprpaper.",
  mpvpaper: "mpvpaper.",
  "wayland-utauri": "waylandutauri.",
};

const GENERAL_BACKEND_SEARCH_KEYS = new Set([
  "_nav",
  "type",
  "selection_mode",
  "auto_priorities",
]);

/** Maps a settings search row key to the inner Backend settings tab id. */
export function inferBackendSettingsSubTabFromSearchKey(key: string): "general" | string {
  if (GENERAL_BACKEND_SEARCH_KEYS.has(key)) return "general";
  for (const [backendId, prefix] of Object.entries(FIELD_PREFIX_BY_BACKEND)) {
    if (key.startsWith(prefix)) return backendId;
  }
  return "general";
}
