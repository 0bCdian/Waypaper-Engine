/**
 * Unified Settings Store for Waypaper Engine
 *
 * Single source of truth for all configuration settings.
 * Syncs with the daemon via HTTP API and listens for SSE config_changed events.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  UnifiedConfig,
  ConfigSection,
  ConfigChangeEvent,
} from "../../shared/types/unifiedConfig";
import { logger } from "../utils/logger";
import { sectionsMatchingSettingsSearchQuery } from "../utils/settingsSearchIndex";

interface SettingsStoreState {
  config: UnifiedConfig | null;
  isLoading: boolean;
  isDirty: boolean;
  lastSaved: number | null;
  errors: Array<{ section: ConfigSection; key: string; message: string }>;
  searchTerm: string;
  filteredSections: ConfigSection[];
  expandedSections: Set<string>;
  /** When set, BackendSettingsSection switches to this inner tab once then clears. */
  pendingBackendSettingsTab: string | null;
}

interface SettingsStoreActions {
  loadConfig: () => Promise<void>;
  /** Save a config section to the daemon. Used by settings page components. */
  saveConfigSection: (section: ConfigSection, data: Record<string, unknown>) => Promise<void>;
  /** PATCH /config/backends/{name} with a flat backend config fragment. */
  saveBackendPatch: (backendName: string, patch: Record<string, unknown>) => Promise<void>;
  /** Alias for saveConfigSection (backward compat with old unifiedConfigStore). */
  setConfigValue: (section: ConfigSection, data: Record<string, unknown>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  setPendingBackendSettingsTab: (tab: string | null) => void;
  clearPendingBackendSettingsTab: () => void;
  toggleSection: (sectionId: string) => void;
  handleConfigChange: (event: ConfigChangeEvent) => void;
  clearErrors: () => void;
}

type SettingsStore = SettingsStoreState & SettingsStoreActions;

const defaultConfig: UnifiedConfig = {
  app: {
    kill_daemon_on_exit: false,
    notifications: true,
    start_minimized: false,
    minimize_instead_of_close: false,
    show_monitor_modal_on_start: true,
    startup_intro: true,
    images_per_page: 50,
    theme: "kolision-raw",
    font_preset: "bundled",
    font_family_body: "",
    font_family_display: "",
    font_family_mono: "",
    sort_by: "imported_at",
    sort_order: "desc",
    image_history_limit: 100,
  },
  daemon: {
    images_dir: "~/.local/share/waypaper-engine/images",
    thumbnails_dir: "~/.cache/waypaper-engine/thumbnails",
    database_dir: "~/.local/share/waypaper-engine/db",
    socket_path: "/run/user/1000/waypaper-engine.sock",
    log_level: "info",
    log_file: "~/.local/share/waypaper-engine/daemon.log",
    log_max_size_mb: 10,
    log_max_backups: 3,
    compositor: "auto",
  },
  backend: {
    type: "awww",
  },
  monitors: {
    selected_monitors: [],
    image_set_type: "individual",
  },
  wallhaven: {
    api_key: "",
    enabled: false,
    scroll_mode: "paginated",
  },
};

let _lastApiSaveAt = 0;

const SETTINGS_SECTION_ORDER: ConfigSection[] = [
  "app",
  "daemon",
  "backend",
  "monitors",
  "wallhaven",
];

const TOP_LEVEL_BACKEND_KEYS = new Set(["type", "selection_mode", "auto_priorities"]);

function mergeLoadedConfig(
  existing: UnifiedConfig,
  incoming: UnifiedConfig,
  registeredBackendNames: string[],
): UnifiedConfig {
  const exB = existing.backend as unknown as Record<string, unknown>;
  const inB = incoming.backend as unknown as Record<string, unknown>;
  const nextBackend: Record<string, unknown> = { ...exB, ...inB };
  for (const name of registeredBackendNames) {
    const exSub = exB[name];
    const inSub = inB[name];
    if (
      inSub !== undefined &&
      inSub !== null &&
      typeof inSub === "object" &&
      !Array.isArray(inSub)
    ) {
      const exRec =
        exSub !== undefined && exSub !== null && typeof exSub === "object" && !Array.isArray(exSub)
          ? (exSub as Record<string, unknown>)
          : {};
      nextBackend[name] = { ...exRec, ...(inSub as Record<string, unknown>) };
    }
  }
  return {
    app: { ...existing.app, ...incoming.app },
    daemon: { ...existing.daemon, ...incoming.daemon },
    backend: nextBackend as unknown as UnifiedConfig["backend"],
    monitors: { ...existing.monitors, ...incoming.monitors },
    wallhaven: { ...existing.wallhaven, ...incoming.wallhaven },
  };
}

type NonBackendSectionKey = Exclude<ConfigSection, "backend">;

/**
 * Applies PATCH /config/{section} JSON (daemon GetSection snapshot) onto local unified config,
 * avoiding a full loadConfig round-trip — important for latency-sensitive UX (e.g. theme swaps).
 */
function mergeUnifiedFromSectionPatchBody(
  base: UnifiedConfig,
  section: NonBackendSectionKey,
  incoming: Record<string, unknown>,
): UnifiedConfig {
  switch (section) {
    case "app":
      return { ...base, app: { ...base.app, ...incoming } };
    case "daemon":
      return { ...base, daemon: { ...base.daemon, ...incoming } };
    case "monitors":
      return { ...base, monitors: { ...base.monitors, ...incoming } };
    case "wallhaven":
      return { ...base, wallhaven: { ...base.wallhaven, ...incoming } };
    default: {
      const _x: never = section;
      return _x;
    }
  }
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      config: null,
      isLoading: false,
      isDirty: false,
      lastSaved: null,
      errors: [],
      searchTerm: "",
      filteredSections: ["app", "daemon", "backend", "monitors", "wallhaven"],
      expandedSections: new Set<string>(["app"]),
      pendingBackendSettingsTab: null,

      loadConfig: async () => {
        const existing = get().config;
        // Only show the loading spinner on the very first load (config is null).
        // Subsequent reloads (e.g. from SSE file-change events) keep the
        // existing config visible so the page doesn't flash.
        set({ isLoading: !existing, errors: [] });

        try {
          if (window.API_RENDERER?.goDaemon?.getConfig) {
            const incoming = await window.API_RENDERER.goDaemon.getConfig();

            let registeredBackendNames: string[] = [];
            try {
              const gd = window.API_RENDERER.goDaemon;
              if (gd.getBackends && gd.getBackendConfig) {
                const backendsList = await gd.getBackends();
                registeredBackendNames = backendsList.map((b) => b.name);
                const fetched = await Promise.all(
                  registeredBackendNames.map(async (name) => {
                    try {
                      const cfg = await gd.getBackendConfig(name);
                      return { name, cfg: cfg as Record<string, unknown> | null | undefined };
                    } catch {
                      return { name, cfg: undefined };
                    }
                  }),
                );
                const inB = incoming.backend as unknown as Record<string, unknown>;
                for (const { name, cfg } of fetched) {
                  if (cfg && typeof cfg === "object") {
                    const cleaned = { ...cfg };
                    delete cleaned.type;
                    inB[name] = cleaned;
                  }
                }
              }
            } catch {
              // Non-critical: backend subsections may be incomplete until next load
            }

            const merged = existing
              ? mergeLoadedConfig(existing, incoming, registeredBackendNames)
              : incoming;
            set({
              config: merged as UnifiedConfig,
              isLoading: false,
              isDirty: false,
              lastSaved: Date.now(),
            });
          } else {
            set({
              config: existing ?? defaultConfig,
              isLoading: false,
            });
          }
        } catch (error) {
          logger.error("SettingsStore: Failed to load config:", error);
          set({
            config: existing ?? defaultConfig,
            isLoading: false,
            errors: [
              {
                section: "app",
                key: "load",
                message: "Failed to load configuration",
              },
            ],
          });
        }
      },

      saveConfigSection: async (section: ConfigSection, data: Record<string, unknown>) => {
        const currentConfig = get().config;
        if (!currentConfig) return;

        const isBackendTypeChange =
          section === "backend" && "type" in data && Object.keys(data).length === 1;

        const newConfig = { ...currentConfig };
        if (section === "app") {
          newConfig.app = { ...newConfig.app, ...data } as typeof newConfig.app;
        } else if (section === "daemon") {
          newConfig.daemon = {
            ...newConfig.daemon,
            ...data,
          } as typeof newConfig.daemon;
        } else if (section === "backend") {
          if (isBackendTypeChange) {
            newConfig.backend = {
              ...newConfig.backend,
              type: data.type as string,
            } as typeof newConfig.backend;
          } else {
            const top: Record<string, unknown> = {};
            const ignored: string[] = [];
            for (const [k, v] of Object.entries(data)) {
              if (TOP_LEVEL_BACKEND_KEYS.has(k)) {
                top[k] = v;
              } else {
                ignored.push(k);
              }
            }
            if (ignored.length > 0) {
              logger.warn(
                "SettingsStore: saveConfigSection(backend) ignores per-renderer keys; use saveBackendPatch:",
                ignored.join(", "),
              );
            }
            newConfig.backend = {
              ...newConfig.backend,
              ...top,
            } as typeof newConfig.backend;
          }
        } else if (section === "monitors") {
          newConfig.monitors = {
            ...newConfig.monitors,
            ...data,
          } as typeof newConfig.monitors;
        } else if (section === "wallhaven") {
          newConfig.wallhaven = {
            ...newConfig.wallhaven,
            ...data,
          } as typeof newConfig.wallhaven;
        }

        set({ config: newConfig, errors: [] });
        _lastApiSaveAt = Date.now();

        try {
          if (section === "backend") {
            if (isBackendTypeChange) {
              if (window.API_RENDERER?.goDaemon?.activateBackend) {
                await window.API_RENDERER.goDaemon.activateBackend(data.type as string);
                // Re-fetch config so the UI reflects what the daemon actually persisted
                // (in case the activation rolled back due to a failed backend init).
                await get().loadConfig();
              }
            } else {
              const top: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(data)) {
                if (TOP_LEVEL_BACKEND_KEYS.has(k)) {
                  top[k] = v;
                }
              }
              if (Object.keys(top).length > 0 && window.API_RENDERER?.goDaemon?.updateConfig) {
                await window.API_RENDERER.goDaemon.updateConfig({
                  backend: top,
                } as unknown as Partial<UnifiedConfig>);
              }
              if (
                data.selection_mode === "fixed" &&
                typeof newConfig.backend.type === "string" &&
                newConfig.backend.type.length > 0 &&
                window.API_RENDERER?.goDaemon?.activateBackend
              ) {
                await window.API_RENDERER.goDaemon.activateBackend(newConfig.backend.type);
              }
              if (Object.keys(top).length > 0) {
                await get().loadConfig();
              }
            }
          } else {
            if (window.API_RENDERER?.goDaemon?.updateConfigSection) {
              const patchBody = await window.API_RENDERER.goDaemon.updateConfigSection(
                section,
                data,
              );
              const current = get().config!;
              const nonBackend = section as NonBackendSectionKey;
              const body =
                patchBody !== null &&
                patchBody !== undefined &&
                typeof patchBody === "object" &&
                !Array.isArray(patchBody)
                  ? (patchBody as Record<string, unknown>)
                  : null;

              if (body !== null && Object.keys(body).length > 0) {
                set({
                  config: mergeUnifiedFromSectionPatchBody(current, nonBackend, body),
                  lastSaved: Date.now(),
                });
              } else {
                await get().loadConfig();
              }
            }
          }
          _lastApiSaveAt = Date.now();
          set({ lastSaved: Date.now() });
        } catch (error) {
          logger.error("SettingsStore: Failed to update config:", error);
          set({
            config: currentConfig,
            errors: [
              {
                section,
                key: "save",
                message: `Failed to save ${section} config`,
              },
            ],
          });
        }
      },

      saveBackendPatch: async (backendName: string, patch: Record<string, unknown>) => {
        const currentConfig = get().config;
        if (!currentConfig) return;

        const newConfig = { ...currentConfig };
        const prev = (newConfig.backend as unknown as Record<string, unknown>)[backendName] as
          | Record<string, unknown>
          | undefined;
        (newConfig.backend as unknown as Record<string, unknown>)[backendName] = {
          ...prev,
          ...patch,
        };
        const patchKeys = Object.keys(patch);
        const errorKey =
          patchKeys.length === 1 ? `${backendName}:${patchKeys[0]}` : `${backendName}:save`;

        set({ config: newConfig as UnifiedConfig, errors: [] });
        _lastApiSaveAt = Date.now();

        try {
          if (window.API_RENDERER?.goDaemon?.updateBackendConfig) {
            await window.API_RENDERER.goDaemon.updateBackendConfig(backendName, patch);
          }
          _lastApiSaveAt = Date.now();
          set({ lastSaved: Date.now() });
        } catch (error) {
          logger.error("SettingsStore: Failed to update backend config:", error);
          set({
            config: currentConfig,
            errors: [
              {
                section: "backend",
                key: errorKey,
                message: `Failed to save ${backendName} settings`,
              },
            ],
          });
        }
      },

      // Alias so callers that used the old unifiedConfigStore API still work.
      setConfigValue: (...args) => get().saveConfigSection(...args),

      resetToDefaults: async () => {
        set({ isLoading: true });
        try {
          if (window.API_RENDERER?.goDaemon?.updateConfig) {
            await window.API_RENDERER.goDaemon.updateConfig(defaultConfig);
          }
          set({ config: defaultConfig, isLoading: false, isDirty: false });
        } catch (error) {
          logger.error("SettingsStore: Failed to reset config:", error);
          set({ isLoading: false });
        }
      },

      setSearchTerm: (term: string) => {
        set({ searchTerm: term });

        if (term.trim() === "") {
          set({ filteredSections: ["app", "daemon", "backend", "monitors", "wallhaven"] });
          return;
        }

        const tokens = term.trim().toLowerCase().split(/\s+/).filter(Boolean);

        const indexMatched = new Set(sectionsMatchingSettingsSearchQuery(term));

        const config = get().config;
        const fromConfig = new Set<ConfigSection>();

        if (config && tokens.length > 0) {
          Object.entries(config).forEach(([sectionKey, sectionData]) => {
            const section = sectionKey as ConfigSection;
            if (typeof sectionData !== "object" || sectionData === null) return;
            const matches = tokens.every((token) =>
              Object.entries(sectionData).some(
                ([key, value]) =>
                  key.toLowerCase().includes(token) || String(value).toLowerCase().includes(token),
              ),
            );
            if (matches) fromConfig.add(section);
          });
        }

        const merged = SETTINGS_SECTION_ORDER.filter(
          (s) => fromConfig.has(s) || indexMatched.has(s),
        );
        set({ filteredSections: merged });
      },

      clearSearch: () => {
        set({
          searchTerm: "",
          filteredSections: ["app", "daemon", "backend", "monitors", "wallhaven"],
        });
      },

      setPendingBackendSettingsTab: (tab: string | null) => {
        set({ pendingBackendSettingsTab: tab });
      },

      clearPendingBackendSettingsTab: () => {
        set({ pendingBackendSettingsTab: null });
      },

      toggleSection: (sectionId: string) => {
        const expandedSections = new Set(get().expandedSections);
        if (expandedSections.has(sectionId)) {
          expandedSections.delete(sectionId);
        } else {
          expandedSections.add(sectionId);
        }
        set({ expandedSections });
      },

      handleConfigChange: (event: ConfigChangeEvent) => {
        const source = (event as unknown as Record<string, unknown>)?.source;
        const suppressedByApiSave = source === "file" && Date.now() - _lastApiSaveAt < 2000;
        if (source === "file" && !suppressedByApiSave) {
          get().loadConfig();
        }
      },

      clearErrors: () => {
        set({ errors: [] });
      },
    }),
    { name: "settings-store" },
  ),
);

let _disposeConfigChanged: (() => void) | undefined;

function initConfigListener() {
  _disposeConfigChanged?.();
  if (typeof window !== "undefined" && window.API_RENDERER?.goDaemon) {
    _disposeConfigChanged = window.API_RENDERER.goDaemon.on("config_changed", (data: unknown) => {
      const store = useSettingsStore.getState();
      store.handleConfigChange(data as ConfigChangeEvent);
    });
  }
}

initConfigListener();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _disposeConfigChanged?.();
  });
}
