import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";
import type { UnifiedConfig, ConfigSection } from "../../shared/types/unifiedConfig";

// Import existing components to reuse
import { BezierCurveEditor } from "react-bezier-curve-editor";
import {
    FilterType,
    ResizeType,
    TransitionType,
    transitionPosition
} from "../../shared/types/swww";

const { goDaemon } = window.API_RENDERER;

// Configuration Section Component
interface ConfigSectionProps {
  title: string;
  section: ConfigSection;
  children: React.ReactNode;
}

const ConfigSection = ({ title, section, children }: ConfigSectionProps) => {
  return (
    <motion.div
      className="bg-base-100 rounded-lg p-6 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-4 text-primary">{title}</h2>
      <div className="space-y-4">
        {children}
      </div>
    </motion.div>
  );
};

// App Configuration Form
interface AppConfigFormProps {
  config: UnifiedConfig['app'];
  onUpdate: (section: ConfigSection, key: string, value: unknown) => void;
}

const AppConfigForm = ({ config, onUpdate }: AppConfigFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Kill daemon on exit */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Kill daemon on app exit</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.kill_daemon_on_exit}
            onChange={(e) => onUpdate('app', 'kill_daemon_on_exit', e.target.checked)}
          />
        </label>
      </div>

      {/* Notifications */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Enable notifications</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.notifications}
            onChange={(e) => onUpdate('app', 'notifications', e.target.checked)}
          />
        </label>
      </div>

      {/* Start minimized */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Start minimized</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.start_minimized}
            onChange={(e) => onUpdate('app', 'start_minimized', e.target.checked)}
          />
        </label>
      </div>

      {/* Minimize instead of close */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Minimize instead of close</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.minimize_instead_of_close}
            onChange={(e) => onUpdate('app', 'minimize_instead_of_close', e.target.checked)}
          />
        </label>
      </div>

      {/* Random image monitor */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Random image monitor</span>
        </label>
        <select
          className="select select-bordered"
          value={config.random_image_monitor}
          onChange={(e) => onUpdate('app', 'random_image_monitor', e.target.value)}
        >
          <option value="individual">Individual</option>
          <option value="clone">Clone</option>
          <option value="extend">Extend</option>
        </select>
      </div>

      {/* Show monitor modal on start */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Show monitor modal on start</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.show_monitor_modal_on_start}
            onChange={(e) => onUpdate('app', 'show_monitor_modal_on_start', e.target.checked)}
          />
        </label>
      </div>

      {/* Images per page */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Images per page</span>
        </label>
        <input
          type="number"
          className="input input-bordered"
          min="1"
          max="100"
          value={config.images_per_page}
          onChange={(e) => onUpdate('app', 'images_per_page', parseInt(e.target.value))}
        />
      </div>

      {/* Theme */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Theme</span>
        </label>
        <select
          className="select select-bordered"
          value={config.theme}
          onChange={(e) => onUpdate('app', 'theme', e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Sidebar collapsed */}
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Sidebar collapsed</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.sidebar_collapsed}
            onChange={(e) => onUpdate('app', 'sidebar_collapsed', e.target.checked)}
          />
        </label>
      </div>

      {/* Sort by */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Sort by</span>
        </label>
        <select
          className="select select-bordered"
          value={config.sort_by}
          onChange={(e) => onUpdate('app', 'sort_by', e.target.value)}
        >
          <option value="name">Name</option>
          <option value="date">Date</option>
          <option value="size">Size</option>
        </select>
      </div>

      {/* Sort order */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Sort order</span>
        </label>
        <select
          className="select select-bordered"
          value={config.sort_order}
          onChange={(e) => onUpdate('app', 'sort_order', e.target.value)}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      {/* Image history limit */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Image history limit</span>
        </label>
        <input
          type="number"
          className="input input-bordered"
          min="0"
          max="1000"
          value={config.image_history_limit}
          onChange={(e) => onUpdate('app', 'image_history_limit', parseInt(e.target.value))}
        />
      </div>
    </div>
  );
};

// Daemon Configuration Form
interface DaemonConfigFormProps {
  config: UnifiedConfig['daemon'];
  onUpdate: (section: ConfigSection, key: string, value: unknown) => void;
}

const DaemonConfigForm = ({ config, onUpdate }: DaemonConfigFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Database path */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Database path</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.database_path}
          onChange={(e) => onUpdate('daemon', 'database_path', e.target.value)}
        />
      </div>

      {/* Images directory */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Images directory</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.images_dir}
          onChange={(e) => onUpdate('daemon', 'images_dir', e.target.value)}
        />
      </div>

      {/* Thumbnails directory */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Thumbnails directory</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.thumbnails_dir}
          onChange={(e) => onUpdate('daemon', 'thumbnails_dir', e.target.value)}
        />
      </div>

      {/* Monitors state file */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Monitors state file</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.monitors_state_file}
          onChange={(e) => onUpdate('daemon', 'monitors_state_file', e.target.value)}
        />
      </div>

      {/* Socket path */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Socket path</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.socket_path}
          onChange={(e) => onUpdate('daemon', 'socket_path', e.target.value)}
        />
      </div>

      {/* Log level */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Log level</span>
        </label>
        <select
          className="select select-bordered"
          value={config.log_level}
          onChange={(e) => onUpdate('daemon', 'log_level', e.target.value)}
        >
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Log file */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Log file</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          value={config.log_file}
          onChange={(e) => onUpdate('daemon', 'log_file', e.target.value)}
        />
      </div>

      {/* Log max size */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Log max size (MB)</span>
        </label>
        <input
          type="number"
          className="input input-bordered"
          min="1"
          max="100"
          value={config.log_max_size}
          onChange={(e) => onUpdate('daemon', 'log_max_size', parseInt(e.target.value))}
        />
      </div>

      {/* Log max age */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Log max age (days)</span>
        </label>
        <input
          type="number"
          className="input input-bordered"
          min="1"
          max="365"
          value={config.log_max_age}
          onChange={(e) => onUpdate('daemon', 'log_max_age', parseInt(e.target.value))}
        />
      </div>

      {/* Log max backups */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Log max backups</span>
        </label>
        <input
          type="number"
          className="input input-bordered"
          min="1"
          max="10"
          value={config.log_max_backups}
          onChange={(e) => onUpdate('daemon', 'log_max_backups', parseInt(e.target.value))}
        />
      </div>

      {/* Compositor */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Compositor</span>
        </label>
        <select
          className="select select-bordered"
          value={config.compositor}
          onChange={(e) => onUpdate('daemon', 'compositor', e.target.value)}
        >
          <option value="auto">Auto</option>
          <option value="x11">X11</option>
          <option value="wayland">Wayland</option>
        </select>
      </div>
    </div>
  );
};

// Backend Configuration Form (reusing SwwwConfig components)
interface BackendConfigFormProps {
  config: UnifiedConfig['backend'];
  onUpdate: (section: ConfigSection, key: string, value: unknown) => void;
}

const BackendConfigForm = ({ config, onUpdate }: BackendConfigFormProps) => {
  const [bezier, setBezier] = useState<[number, number, number, number]>([0.25, 0.1, 0.25, 1]);

  // Parse bezier curve from string
  useEffect(() => {
    if (config.swww.transition_bezier) {
      const values = config.swww.transition_bezier.split(',').map(v => parseFloat(v.trim()));
      if (values.length === 4) {
        setBezier([values[0], values[1], values[2], values[3]]);
      }
    }
  }, [config.swww.transition_bezier]);

  return (
    <div className="space-y-6">
      {/* Backend type */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Backend type</span>
        </label>
        <select
          className="select select-bordered"
          value={config.type}
          onChange={(e) => onUpdate('backend', 'type', e.target.value)}
        >
          <option value="swww">Swww</option>
          <option value="feh">Feh</option>
          <option value="nitrogen">Nitrogen</option>
          <option value="hyprpaper">Hyprpaper</option>
          <option value="wallutils">Wallutils</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Swww-specific configuration */}
      {config.type === 'swww' && (
        <div className="bg-base-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Swww Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Transition type */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition type</span>
              </label>
              <select
                className="select select-bordered"
                value={config.swww.transition_type}
                onChange={(e) => onUpdate('backend', 'swww.transition_type', e.target.value)}
              >
                <option value="simple">Simple</option>
                <option value="wipe">Wipe</option>
                <option value="grow">Grow</option>
                <option value="outer">Outer</option>
                <option value="wave">Wave</option>
              </select>
            </div>

            {/* Transition step */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition step</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                min="1"
                max="360"
                value={config.swww.transition_step}
                onChange={(e) => onUpdate('backend', 'swww.transition_step', parseInt(e.target.value))}
              />
            </div>

            {/* Transition duration */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition duration (ms)</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                min="0"
                max="10000"
                value={config.swww.transition_duration}
                onChange={(e) => onUpdate('backend', 'swww.transition_duration', parseInt(e.target.value))}
              />
            </div>

            {/* Transition angle */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition angle</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                min="0"
                max="360"
                value={config.swww.transition_angle}
                onChange={(e) => onUpdate('backend', 'swww.transition_angle', parseInt(e.target.value))}
              />
            </div>

            {/* Transition position */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition position</span>
              </label>
              <select
                className="select select-bordered"
                value={config.swww.transition_pos}
                onChange={(e) => onUpdate('backend', 'swww.transition_pos', e.target.value)}
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            {/* Transition bezier curve */}
            <div className="form-control col-span-full">
              <label className="label">
                <span className="label-text">Transition bezier curve</span>
              </label>
              <div className="bg-base-100 rounded-lg p-4">
                <BezierCurveEditor
                  value={bezier}
                  onChange={(newBezier) => {
                    setBezier(newBezier);
                    onUpdate('backend', 'swww.transition_bezier', `${newBezier[0]},${newBezier[1]},${newBezier[2]},${newBezier[3]}`);
                  }}
                />
              </div>
            </div>

            {/* Transition wave */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Transition wave</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={config.swww.transition_wave}
                onChange={(e) => onUpdate('backend', 'swww.transition_wave', e.target.value)}
                placeholder="0,0,0,0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Monitors Configuration Form
interface MonitorsConfigFormProps {
  config: UnifiedConfig['monitors'];
  onUpdate: (section: ConfigSection, key: string, value: unknown) => void;
}

const MonitorsConfigForm = ({ config, onUpdate }: MonitorsConfigFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Image set type */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Image set type</span>
        </label>
        <select
          className="select select-bordered"
          value={config.image_set_type}
          onChange={(e) => onUpdate('monitors', 'image_set_type', e.target.value)}
        >
          <option value="individual">Individual</option>
          <option value="extend">Extend</option>
          <option value="clone">Clone</option>
        </select>
      </div>

      {/* Selected monitors */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Selected monitors</span>
        </label>
        <div className="text-sm text-base-content/70">
          {config.selected_monitors.length > 0 
            ? config.selected_monitors.join(', ')
            : 'No monitors selected'
          }
        </div>
        <div className="text-xs text-base-content/50 mt-1">
          Monitor selection is managed through the main interface
        </div>
      </div>
    </div>
  );
};

// Main Configuration Page
const Configuration = () => {
  const { 
    config, 
    isLoading, 
    errors, 
    loadConfig, 
    setConfigValue, 
    resetToDefaults,
    handleConfigChange,
    clearErrors
  } = useUnifiedConfigStore();

  // Load config on mount
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Set up config change event listener
  useEffect(() => {
    if (window.API_RENDERER?.goDaemon?.onConfigChanged) {
      window.API_RENDERER.goDaemon.onConfigChanged(handleConfigChange);
      
      return () => {
        if (window.API_RENDERER?.goDaemon?.offConfigChanged) {
          window.API_RENDERER.goDaemon.offConfigChanged(handleConfigChange);
        }
      };
    }
  }, [handleConfigChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Failed to load configuration</h2>
          <button 
            className="btn btn-primary"
            onClick={() => void loadConfig()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="min-h-screen bg-base-200 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">Configuration</h1>
            <p className="text-lg text-base-content/70">
              Unified configuration for all Waypaper Engine settings
            </p>
          </div>

          {/* Error display */}
          {errors.length > 0 && (
            <div className="alert alert-error">
              <div>
                <h3 className="font-bold">Configuration Errors</h3>
                <ul className="list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>
                      {error.section}.{error.key}: {error.message}
                    </li>
                  ))}
                </ul>
                <button 
                  className="btn btn-sm btn-outline mt-2"
                  onClick={clearErrors}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Configuration sections */}
          <ConfigSection title="Application Settings" section="app">
            <AppConfigForm config={config.app} onUpdate={setConfigValue} />
          </ConfigSection>

          <ConfigSection title="Daemon Settings" section="daemon">
            <DaemonConfigForm config={config.daemon} onUpdate={setConfigValue} />
          </ConfigSection>

          <ConfigSection title="Backend Settings" section="backend">
            <BackendConfigForm config={config.backend} onUpdate={setConfigValue} />
          </ConfigSection>

          <ConfigSection title="Monitor Settings" section="monitors">
            <MonitorsConfigForm config={config.monitors} onUpdate={setConfigValue} />
          </ConfigSection>

          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <button 
              className="btn btn-outline"
              onClick={() => void resetToDefaults()}
            >
              Reset to Defaults
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => void loadConfig()}
            >
              Reload Configuration
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Configuration;
