import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UnifiedConfig, ConfigChangeEvent, ConfigSection, ConfigValidationError, ConfigFormState } from '../../shared/types/unifiedConfig';

interface UnifiedConfigStore extends ConfigFormState {
  config: UnifiedConfig | null;
  
  // Actions
  loadConfig: () => Promise<void>;
  setConfigValue: (section: ConfigSection, key: string, value: unknown) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  
  // Event handling
  handleConfigChange: (event: ConfigChangeEvent) => void;
  
  // Validation
  validateConfig: (config: Partial<UnifiedConfig>) => ConfigValidationError[];
  clearErrors: () => void;
}

const defaultConfig: UnifiedConfig = {
  app: {
    kill_daemon_on_exit: false,
    notifications: true,
    start_minimized: false,
    minimize_instead_of_close: true,
    random_image_monitor: "individual",
    show_monitor_modal_on_start: false,
    images_per_page: 20,
    theme: "dark",
    sidebar_collapsed: false,
    sort_by: "name",
    sort_order: "asc",
    image_history_limit: 50,
  },
  daemon: {
    database_path: "~/.config/waypaper-engine/data",
    images_dir: "~/.waypaper-engine/images",
    thumbnails_dir: "~/.waypaper-engine/data/cache/thumbnails",
    monitors_state_file: "~/.cache/waypaper-engine/monitors.json",
    socket_path: "/tmp/waypaper-engine.sock",
    log_level: "info",
    log_file: "~/.config/waypaper-engine/daemon.log",
    log_max_size: 10,
    log_max_age: 7,
    log_max_backups: 3,
    compositor: "auto",
  },
  backend: {
    type: "swww",
    swww: {
      transition_type: "simple",
      transition_step: 90,
      transition_duration: 200,
      transition_angle: 45,
      transition_pos: "center",
      transition_bezier: "0.4,0.0,0.2,1",
      transition_wave: "0,0,0,0",
    },
  },
  monitors: {
    selected_monitors: [],
    image_set_type: "individual",
  },
};

export const useUnifiedConfigStore = create<UnifiedConfigStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      config: null,
      isLoading: false,
      isDirty: false,
      errors: [],
      lastSaved: null,

      // Load configuration from daemon
      loadConfig: async () => {
        set({ isLoading: true, errors: [] });
        
        try {
          if (window.API_RENDERER?.goDaemon?.getConfig) {
            const config = await window.API_RENDERER.goDaemon.getConfig();
            set({ 
              config, 
              isLoading: false, 
              isDirty: false,
              lastSaved: Date.now()
            });
            console.log('🟢 UnifiedConfig: Config loaded successfully', config);
          } else {
            console.warn('🔴 UnifiedConfig: getConfig method not available');
            set({ 
              config: defaultConfig, 
              isLoading: false 
            });
          }
        } catch (error) {
          console.error('🔴 UnifiedConfig: Failed to load config:', error);
          set({ 
            config: defaultConfig, 
            isLoading: false,
            errors: [{ section: 'app', key: 'load', message: 'Failed to load configuration' }]
          });
        }
      },

      // Set a specific configuration value
      setConfigValue: async (section: ConfigSection, key: string, value: unknown) => {
        const currentConfig = get().config;
        if (!currentConfig) {
          console.error('🔴 UnifiedConfig: No config loaded');
          return;
        }

        // Optimistic update
        const newConfig = { ...currentConfig };
        if (section === 'app') {
          newConfig.app = { ...newConfig.app, [key]: value };
        } else if (section === 'daemon') {
          newConfig.daemon = { ...newConfig.daemon, [key]: value };
        } else if (section === 'backend') {
          if (key.startsWith('swww.')) {
            const swwwKey = key.replace('swww.', '');
            newConfig.backend.swww = { ...newConfig.backend.swww, [swwwKey]: value };
          } else {
            newConfig.backend = { ...newConfig.backend, [key]: value };
          }
        } else if (section === 'monitors') {
          newConfig.monitors = { ...newConfig.monitors, [key]: value };
        }

        set({ config: newConfig, isDirty: true });

        try {
          if (window.API_RENDERER?.goDaemon?.setConfig) {
            await window.API_RENDERER.goDaemon.setConfig(section, key, value);
            set({ 
              isDirty: false, 
              lastSaved: Date.now(),
              errors: []
            });
            console.log('🟢 UnifiedConfig: Config updated successfully', { section, key, value });
          } else {
            console.warn('🔴 UnifiedConfig: setConfig method not available');
          }
        } catch (error) {
          console.error('🔴 UnifiedConfig: Failed to update config:', error);
          // Revert optimistic update
          set({ config: currentConfig });
          set({ 
            errors: [{ section, key, message: `Failed to update ${key}` }]
          });
        }
      },

      // Reset to default configuration
      resetToDefaults: async () => {
        set({ isLoading: true });
        
        try {
          // Reset each section to defaults
          for (const [section, sectionConfig] of Object.entries(defaultConfig)) {
            for (const [key, value] of Object.entries(sectionConfig)) {
              if (window.API_RENDERER?.goDaemon?.setConfig) {
                await window.API_RENDERER.goDaemon.setConfig(section as ConfigSection, key, value);
              }
            }
          }
          
          set({ 
            config: defaultConfig, 
            isLoading: false, 
            isDirty: false,
            lastSaved: Date.now(),
            errors: []
          });
          console.log('🟢 UnifiedConfig: Reset to defaults successful');
        } catch (error) {
          console.error('🔴 UnifiedConfig: Failed to reset to defaults:', error);
          set({ 
            isLoading: false,
            errors: [{ section: 'app', key: 'reset', message: 'Failed to reset configuration' }]
          });
        }
      },

      // Handle config change events from daemon
      handleConfigChange: (event: ConfigChangeEvent) => {
        const currentConfig = get().config;
        if (!currentConfig) return;

        console.log('🟡 UnifiedConfig: Received config change event', event);

        // Update the config with the new value
        const newConfig = { ...currentConfig };
        if (event.section === 'app') {
          newConfig.app = { ...newConfig.app, [event.key]: event.value };
        } else if (event.section === 'daemon') {
          newConfig.daemon = { ...newConfig.daemon, [event.key]: event.value };
        } else if (event.section === 'backend') {
          if (event.key.startsWith('swww.')) {
            const swwwKey = event.key.replace('swww.', '');
            newConfig.backend.swww = { ...newConfig.backend.swww, [swwwKey]: event.value };
          } else {
            newConfig.backend = { ...newConfig.backend, [event.key]: event.value };
          }
        } else if (event.section === 'monitors') {
          newConfig.monitors = { ...newConfig.monitors, [event.key]: event.value };
        }

        set({ 
          config: newConfig, 
          isDirty: false,
          lastSaved: event.timestamp * 1000 // Convert to milliseconds
        });
      },

      // Validate configuration
      validateConfig: (config: Partial<UnifiedConfig>): ConfigValidationError[] => {
        const errors: ConfigValidationError[] = [];

        // Validate app config
        if (config.app) {
          if (config.app.images_per_page < 1 || config.app.images_per_page > 100) {
            errors.push({ section: 'app', key: 'images_per_page', message: 'Images per page must be between 1 and 100' });
          }
          if (config.app.image_history_limit < 0 || config.app.image_history_limit > 1000) {
            errors.push({ section: 'app', key: 'image_history_limit', message: 'Image history limit must be between 0 and 1000' });
          }
        }

        // Validate daemon config
        if (config.daemon) {
          if (config.daemon.log_max_size < 1 || config.daemon.log_max_size > 100) {
            errors.push({ section: 'daemon', key: 'log_max_size', message: 'Log max size must be between 1 and 100 MB' });
          }
          if (config.daemon.log_max_age < 1 || config.daemon.log_max_age > 365) {
            errors.push({ section: 'daemon', key: 'log_max_age', message: 'Log max age must be between 1 and 365 days' });
          }
        }

        // Validate backend config
        if (config.backend?.swww) {
          if (config.backend.swww.transition_step < 1 || config.backend.swww.transition_step > 360) {
            errors.push({ section: 'backend', key: 'swww.transition_step', message: 'Transition step must be between 1 and 360' });
          }
          if (config.backend.swww.transition_duration < 0 || config.backend.swww.transition_duration > 10000) {
            errors.push({ section: 'backend', key: 'swww.transition_duration', message: 'Transition duration must be between 0 and 10000 ms' });
          }
        }

        return errors;
      },

      // Clear validation errors
      clearErrors: () => {
        set({ errors: [] });
      },
    }),
    {
      name: 'unified-config-store',
    }
  )
);
