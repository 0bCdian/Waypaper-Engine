// Unified configuration types matching the TOML structure
// This replaces the fragmented config types with a single source of truth

export interface AppConfig {
  kill_daemon_on_exit: boolean;
  notifications: boolean;
  start_minimized: boolean;
  minimize_instead_of_close: boolean;
  random_image_monitor: "individual" | "clone" | "extend";
  show_monitor_modal_on_start: boolean;
  images_per_page: number;
  theme: "light" | "dark" | "system";
  sidebar_collapsed: boolean;
  sort_by: "name" | "date" | "size";
  sort_order: "asc" | "desc";
  image_history_limit: number;
}

export interface DaemonConfig {
  database_path: string;
  images_dir: string;
  thumbnails_dir: string;
  monitors_state_file: string;
  socket_path: string;
  log_level: "debug" | "info" | "warn" | "error";
  log_file: string;
  log_max_size: number; // MB
  log_max_age: number; // days
  log_max_backups: number;
  compositor: "auto" | "x11" | "wayland";
}

export interface SwwwConfig {
  transition_type: "simple" | "wipe" | "grow" | "outer" | "wave";
  transition_step: number;
  transition_duration: number; // milliseconds
  transition_angle: number;
  transition_pos: "center" | "top" | "bottom" | "left" | "right";
  transition_bezier: string;
  transition_wave: string;
}

export interface BackendConfig {
  type: "swww" | "feh" | "nitrogen" | "hyprpaper" | "wallutils" | "custom";
  swww: SwwwConfig;
}

export interface MonitorsConfig {
  selected_monitors: string[];
  image_set_type: "individual" | "extend" | "clone";
}

export interface UnifiedConfig {
  app: AppConfig;
  daemon: DaemonConfig;
  backend: BackendConfig;
  monitors: MonitorsConfig;
}

// Configuration change event types
export interface ConfigChangeEvent {
  section: keyof UnifiedConfig;
  key: string;
  value: unknown;
  timestamp: number;
}

// Configuration section types for form handling
export type ConfigSection = keyof UnifiedConfig;

// Helper types for form validation
export interface ConfigValidationError {
  section: ConfigSection;
  key: string;
  message: string;
}

export interface ConfigFormState {
  isLoading: boolean;
  isDirty: boolean;
  errors: ConfigValidationError[];
  lastSaved: number | null;
}
