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

interface SettingsStoreState {
  config: UnifiedConfig | null;
  isLoading: boolean;
  isDirty: boolean;
  lastSaved: number | null;
  errors: Array<{ section: ConfigSection; key: string; message: string }>;
  searchTerm: string;
  filteredSections: ConfigSection[];
  expandedSections: Set<string>;
  showAdvancedSettings: boolean;
}

interface SettingsStoreActions {
  loadConfig: () => Promise<void>;
  /** Save a config section to the daemon. Used by settings page components. */
  saveConfigSection: (section: ConfigSection, data: Record<string, unknown>) => Promise<void>;
  /** Alias for saveConfigSection (backward compat with old unifiedConfigStore). */
  setConfigValue: (section: ConfigSection, data: Record<string, unknown>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  toggleSection: (sectionId: string) => void;
  setShowAdvancedSettings: (show: boolean) => void;
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
    show_monitor_modal_on_start: false,
    images_per_page: 50,
    theme: "dark",
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
    type: "swww",
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
      showAdvancedSettings: false,

      loadConfig: async () => {
        const existing = get().config;
        // Only show the loading spinner on the very first load (config is null).
        // Subsequent reloads (e.g. from SSE file-change events) keep the
        // existing config visible so the page doesn't flash.
        set({ isLoading: !existing, errors: [] });

        try {
          if (window.API_RENDERER?.goDaemon?.getConfig) {
            const incoming = await window.API_RENDERER.goDaemon.getConfig();

            // The main GET /config doesn't include backend sub-configs (swww, feh, etc.)
            // because the Go struct only has "type". Fetch the active backend config
            // separately and merge it in.
            try {
              if (window.API_RENDERER.goDaemon.getBackendConfig) {
                const backendConfig = await window.API_RENDERER.goDaemon.getBackendConfig();
                if (backendConfig) {
                  const backendType = incoming.backend?.type ?? "swww";
                  const cleaned = { ...backendConfig } as unknown as Record<string, unknown>;
                  delete cleaned.type;
                  (incoming.backend as unknown as Record<string, unknown>)[backendType] = cleaned;
                }
              }
            } catch {
              // Non-critical: backend settings will just show defaults
            }

            const merged = existing
              ? (() => {
                  const activeBackend = incoming.backend?.type ?? existing.backend?.type ?? "swww";
                  const existingBackendSub = (
                    existing.backend as unknown as Record<string, unknown>
                  )?.[activeBackend] as Record<string, unknown> | undefined;
                  const incomingBackendSub = (
                    incoming.backend as unknown as Record<string, unknown>
                  )?.[activeBackend] as Record<string, unknown> | undefined;
                  return {
                    app: { ...existing.app, ...incoming.app },
                    daemon: { ...existing.daemon, ...incoming.daemon },
                    backend: {
                      ...existing.backend,
                      ...incoming.backend,
                      [activeBackend]: incomingBackendSub
                        ? { ...existingBackendSub, ...incomingBackendSub }
                        : existingBackendSub,
                    },
                    monitors: { ...existing.monitors, ...incoming.monitors },
                    wallhaven: { ...existing.wallhaven, ...incoming.wallhaven },
                  };
                })()
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
            const backendType = newConfig.backend.type ?? "swww";
            newConfig.backend = {
              ...newConfig.backend,
              [backendType]: {
                ...((newConfig.backend as unknown as Record<string, unknown>)[backendType] as
                  | Record<string, unknown>
                  | undefined),
                ...data,
              },
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
              }
            } else {
              if (window.API_RENDERER?.goDaemon?.updateBackendConfig) {
                await window.API_RENDERER.goDaemon.updateBackendConfig(
                  data as Record<string, unknown>,
                );
              }
            }
          } else {
            if (window.API_RENDERER?.goDaemon?.updateConfigSection) {
              await window.API_RENDERER.goDaemon.updateConfigSection(section, data);
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

        const config = get().config;
        if (!config) return;

        const filteredSections: ConfigSection[] = [];
        const searchLower = term.toLowerCase();

        Object.entries(config).forEach(([sectionKey, sectionData]) => {
          const section = sectionKey as ConfigSection;
          if (typeof sectionData === "object" && sectionData !== null) {
            const matches = Object.entries(sectionData).some(([key, value]) => {
              return (
                key.toLowerCase().includes(searchLower) ||
                String(value).toLowerCase().includes(searchLower)
              );
            });
            if (matches) {
              filteredSections.push(section);
            }
          }
        });

        set({ filteredSections });
      },

      clearSearch: () => {
        set({
          searchTerm: "",
          filteredSections: ["app", "daemon", "backend", "monitors", "wallhaven"],
        });
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

      setShowAdvancedSettings: (show: boolean) => {
        set({ showAdvancedSettings: show });
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
