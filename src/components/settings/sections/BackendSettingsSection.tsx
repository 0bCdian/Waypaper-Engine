import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection, UnifiedConfig } from "@/shared/types/unifiedConfig";

interface BackendSettingsSectionProps {
  className?: string;
}

interface Field {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/** Display value when `transition_duration_seconds` is unset (derive from legacy backend fields). */
function effectiveTransitionDurationSeconds(config: UnifiedConfig | null): number {
  if (!config?.backend) {
    return 3;
  }
  const c = config.backend.transition_duration_seconds;
  if (c != null && c > 0) {
    return c;
  }
  const t = config.backend.type;
  if (t === "wayland-utauri") {
    const w =
      (config.backend as unknown as Record<string, unknown>)["wayland-utauri"] ??
      (config.backend as unknown as Record<string, unknown>).waylandutauri;
    const ms = (w as { duration_ms?: number } | undefined)?.duration_ms ?? 300;
    return ms / 1000;
  }
  if (t === "awww" && config.backend.awww) {
    const d = config.backend.awww.transition_duration;
    if (Number.isInteger(d) && d >= 500 && d <= 5000) {
      return Math.max(1, Math.round((d + 500) / 1000));
    }
    return d;
  }
  return 3;
}

const transitionDurationSharedField: Field = {
  key: "transition_duration_seconds",
  label: "Transition duration (seconds)",
  description:
    "How long image transitions run. One value for all backends: awww uses it as CLI seconds; wayland-utauri converts to milliseconds.",
  type: "number",
  min: 0.05,
  max: 120,
  step: 0.1,
};

const awwwDisplayFields: Field[] = [
  {
    key: "awww.resize",
    label: "Resize Mode",
    description: "How the image is fitted to the monitor",
    type: "select",
    options: [
      { value: "crop", label: "Crop (cover, preserve aspect ratio)" },
      { value: "fit", label: "Fit (contain, letterbox)" },
      { value: "no", label: "No Resize (native resolution)" },
      { value: "stretch", label: "Stretch (fill, ignore aspect ratio)" },
    ],
  },
  {
    key: "awww.fill_color",
    label: "Fill Color",
    description: 'Color for empty space when resize is "Fit" (hex without #)',
    type: "text",
    placeholder: "000000",
  },
  {
    key: "awww.filter_type",
    label: "Filter Type",
    description: "Resampling filter used when resizing images",
    type: "select",
    options: [
      { value: "Lanczos3", label: "Lanczos3" },
      { value: "Bilinear", label: "Bilinear" },
      { value: "CatmullRom", label: "CatmullRom" },
      { value: "Mitchell", label: "Mitchell" },
      { value: "Nearest", label: "Nearest" },
    ],
  },
];

const awwwTransitionFields: Field[] = [
  {
    key: "awww.transition_type",
    label: "Transition Type",
    description: "Type of transition effect when changing wallpapers",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "simple", label: "Simple" },
      { value: "fade", label: "Fade" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
      { value: "top", label: "Top" },
      { value: "bottom", label: "Bottom" },
      { value: "wipe", label: "Wipe" },
      { value: "wave", label: "Wave" },
      { value: "grow", label: "Grow" },
      { value: "center", label: "Center" },
      { value: "any", label: "Any" },
      { value: "outer", label: "Outer" },
      { value: "random", label: "Random" },
    ],
  },
  {
    key: "awww.transition_step",
    label: "Transition Step",
    description: "Step size for transition effects (0-255)",
    type: "number",
    min: 0,
    max: 255,
    step: 1,
  },
  {
    key: "awww.transition_angle",
    label: "Transition Angle",
    description: "Angle for directional transitions (0-360 degrees)",
    type: "number",
    min: 0,
    max: 360,
    step: 1,
  },
  {
    key: "awww.transition_pos",
    label: "Transition Position",
    description: "Starting position for transitions",
    type: "select",
    options: [
      { value: "center", label: "Center" },
      { value: "top", label: "Top" },
      { value: "bottom", label: "Bottom" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    key: "awww.transition_bezier",
    label: "Transition Bezier",
    description: "Bezier curve parameters (x1,y1,x2,y2)",
    type: "text",
    placeholder: "0.25,0.1,0.25,1",
  },
  {
    key: "awww.transition_wave",
    label: "Transition Wave",
    description: "Wave parameters for wave transitions",
    type: "text",
    placeholder: "0,0,0,0",
  },
  {
    key: "awww.transition_fps",
    label: "Transition FPS",
    description: "Target frames per second for the transition animation",
    type: "number",
    min: 1,
    max: 244,
    step: 1,
  },
  {
    key: "awww.invert_y",
    label: "Invert Y",
    description: "Invert the y-axis for transition animations",
    type: "checkbox",
  },
];

const fehDisplayFields: Field[] = [
  {
    key: "feh.mode",
    label: "Display Mode",
    description: "How the image is fitted to the screen",
    type: "select",
    options: [
      { value: "fill", label: "Fill (cover + crop)" },
      { value: "scale", label: "Scale (fit, letterbox)" },
      { value: "tile", label: "Tile (repeat)" },
      { value: "center", label: "Center (no scaling)" },
      { value: "max", label: "Max (fit + fill remainder)" },
    ],
  },
];

const hyprpaperDisplayFields: Field[] = [
  {
    key: "hyprpaper.fit_mode",
    label: "Fit Mode",
    description: "How hyprpaper scales the wallpaper image",
    type: "select",
    options: [
      { value: "cover", label: "Cover" },
      { value: "contain", label: "Contain" },
      { value: "tile", label: "Tile" },
      { value: "fill", label: "Fill" },
    ],
  },
];

const hyprpaperAdvancedFields: Field[] = [
  {
    key: "hyprpaper.config_path",
    label: "Config Path Override",
    description:
      "Custom path for hyprpaper.conf (leave empty for default ~/.config/hypr/hyprpaper.conf)",
    type: "text",
    placeholder: "~/.config/hypr/hyprpaper.conf",
  },
];

const waylandUtauriTransitionFields: Field[] = [
  {
    key: "waylandutauri.transition",
    label: "Transition Type",
    description: "Transition style used by wayland-utauri (matches waypaper-tauri TransitionMode)",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "fade", label: "Fade" },
      { value: "left", label: "Wipe — left" },
      { value: "right", label: "Wipe — right" },
      { value: "top", label: "Wipe — top" },
      { value: "bottom", label: "Wipe — bottom" },
      { value: "wipe", label: "Wipe" },
      { value: "grow", label: "Grow" },
      { value: "outer", label: "Outer" },
      { value: "wave", label: "Wave" },
      { value: "center", label: "Center" },
      { value: "any", label: "Any" },
      { value: "random", label: "Random" },
      { value: "blur_through", label: "Blur through" },
    ],
  },
  {
    key: "waylandutauri.transition_bezier",
    label: "Transition easing (Bézier)",
    description:
      "CSS cubic-bezier(x1,y1,x2,y2) control points for how transition progress runs over time (comma-separated). Applies on the next wallpaper change.",
    type: "text",
    placeholder: "0.54,0,0.34,0.99",
  },
  {
    key: "waylandutauri.transition_angle_deg",
    label: "Wipe / wave angle (degrees)",
    description:
      "Angle for generic wipe and wave transitions (0–360). Left/right/top/bottom presets ignore this and use fixed angles.",
    type: "number",
    min: 0,
    max: 360,
    step: 1,
  },
  {
    key: "waylandutauri.transition_origin_x_percent",
    label: "Grow / outer origin X (%)",
    description:
      "Horizontal origin (0 = left, 100 = right). Negative or >100 moves the anchor off-screen.",
    type: "number",
    min: -200,
    max: 200,
    step: 1,
  },
  {
    key: "waylandutauri.transition_origin_y_percent",
    label: "Grow / outer origin Y (%)",
    description:
      "Vertical origin (0 = top, 100 = bottom). Negative or >100 moves the anchor off-screen.",
    type: "number",
    min: -200,
    max: 200,
    step: 1,
  },
  {
    key: "waylandutauri.transition_wave_amplitude_percent",
    label: "Wave amplitude (%)",
    description: "Wave edge displacement strength for the wave transition.",
    type: "number",
    min: 0,
    max: 50,
    step: 0.5,
  },
  {
    key: "waylandutauri.transition_wave_frequency",
    label: "Wave frequency",
    description: "Number of wave cycles along the wipe axis.",
    type: "number",
    min: 0.5,
    max: 20,
    step: 0.5,
  },
];

const waylandUtauriParallaxFields: Field[] = [
  {
    key: "waylandutauri.parallax_enabled",
    label: "Enable Parallax",
    description: "Enable wayland-utauri parallax motion",
    type: "checkbox",
  },
  {
    key: "waylandutauri.parallax_zoom",
    label: "Parallax Zoom (%)",
    description: "Zoom used for parallax movement bounds",
    type: "number",
    min: 100,
    max: 200,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_step_percent",
    label: "Parallax Step (%)",
    description: "Default step for manual/script parallax-move calls without amount_percent",
    type: "number",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_workspace_chunk_size",
    label: "Parallax workspace chunk size",
    description:
      "Hyprland/Sway: number of workspace ids per chunk for absolute pan targets (match your bar workspace count).",
    type: "number",
    min: 1,
    max: 64,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_animation_ms",
    label: "Parallax Animation (ms)",
    description: "Animation duration for parallax updates",
    type: "number",
    min: 16,
    max: 5000,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_easing",
    label: "Parallax Easing",
    description: "Cubic bezier string (x1,y1,x2,y2)",
    type: "text",
    placeholder: "0.215,0.610,0.355,1.000",
  },
  {
    key: "waylandutauri.parallax_direction",
    label: "Parallax direction (workspace)",
    description:
      "Whether Hyprland/Sway workspace parallax pans horizontally or vertically. Web wallpapers can override with waypaper.json parallax_direction.",
    type: "select",
    options: [
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
    ],
  },
  {
    key: "waylandutauri.parallax_compositor_driver",
    label: "Compositor parallax driver",
    description:
      "Hyprland/Sway: listens for workspace changes and drives parallax. “off” disables; “auto” picks Hyprland or Sway from the session.",
    type: "select",
    options: [
      { value: "auto", label: "Auto" },
      { value: "off", label: "Off" },
      { value: "hyprland", label: "Hyprland" },
      { value: "sway", label: "Sway" },
    ],
  },
];

const waylandUtauriVideoFields: Field[] = [
  {
    key: "waylandutauri.video_audio_default",
    label: "Default Video Audio",
    description: "Enable audio by default for video wallpapers",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_network_wallpapers",
    label: "Allow network for HTML wallpapers",
    description:
      "Lets local HTML wallpapers use fetch/XHR/WebSocket (WebKit connect-src). Applied immediately via wayland-utauri; restart is only needed for the spawn flag on first start.",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_web_manifest_network",
    label: "Allow manifest to request network capability",
    description:
      "When off, wallpaper `capabilities.network` in waypaper.json is ignored for CSP even if global HTML network is enabled. Defense-in-depth: both this and “Allow network for HTML wallpapers” must be on for outbound fetch.",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_web_keyboard",
    label: "Allow web wallpapers: keyboard",
    description:
      "When off, gallery and manifests cannot enable layer-shell keyboard delivery to HTML wallpapers.",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_web_audio_reactive",
    label: "Allow web wallpapers: audio reactive",
    description:
      "When off, desktop audio capture is not started for wallpapers that request audio_reactive.",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_web_pointer_interactive",
    label: "Allow web wallpapers: pointer interactive",
    description:
      "When off, GTK keeps input-shape passthrough (wallpapers cannot opt into hit-testing).",
    type: "checkbox",
  },
  {
    key: "waylandutauri.allow_web_parallax_aware",
    label: "Allow web wallpapers: parallax_aware flag",
    description:
      "When off, manifest parallax_aware is stripped before apply (mostly declarative; host may still emit parallax).",
    type: "checkbox",
  },
  {
    key: "waylandutauri.renderer_pause",
    label: "Pause HTML wallpaper rendering",
    description:
      "Reduces CPU/GPU by pausing web wallpaper scripts/animations. Synced immediately to wayland-utauri.",
    type: "checkbox",
  },
];

const waylandUtauriAdvancedFields: Field[] = [
  {
    key: "waylandutauri.socket_path",
    label: "Socket Path",
    description: "Unix socket path for wayland-utauri control API",
    type: "text",
  },
  {
    key: "waylandutauri.connect_timeout_ms",
    label: "Connect Timeout (ms)",
    description: "Timeout for connection checks",
    type: "number",
    min: 50,
    max: 30000,
    step: 50,
  },
  {
    key: "waylandutauri.request_timeout_ms",
    label: "Request Timeout (ms)",
    description: "Timeout for API requests",
    type: "number",
    min: 50,
    max: 60000,
    step: 50,
  },
];

function DebouncedFloatInput({
  value: externalValue,
  onCommit,
  className,
  min,
  max,
  step,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [local, setLocal] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocal(String(externalValue));
  }, [externalValue]);

  const commit = useCallback(
    (raw: string) => {
      clearTimeout(timerRef.current);
      const n = Number.parseFloat(raw);
      if (Number.isNaN(n)) return;
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onCommit(v);
    },
    [onCommit, min, max],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocal(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(val), 600);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      className={className}
      value={local}
      onChange={handleChange}
      onBlur={() => commit(local)}
      min={min}
      max={max}
      step={step}
    />
  );
}

function DebouncedNumberInput({
  value: externalValue,
  onCommit,
  className,
  min,
  max,
  step,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [local, setLocal] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocal(String(externalValue));
  }, [externalValue]);

  const commit = useCallback(
    (raw: string) => {
      clearTimeout(timerRef.current);
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n)) onCommit(n);
    },
    [onCommit],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(v), 600);
  };

  return (
    <input
      type="number"
      className={className}
      value={local}
      onChange={handleChange}
      onBlur={() => commit(local)}
      min={min}
      max={max}
      step={step}
    />
  );
}

function DebouncedTextInput({
  value: externalValue,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [prevExternal, setPrevExternal] = useState(externalValue);
  if (externalValue !== prevExternal) {
    setPrevExternal(externalValue);
    setLocal(externalValue);
  }

  const commit = useCallback(
    (v: string) => {
      clearTimeout(timerRef.current);
      onCommit(v);
    },
    [onCommit],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(v), 600);
  };

  return (
    <input
      type="text"
      className={className}
      value={local}
      onChange={handleChange}
      onBlur={() => commit(local)}
      placeholder={placeholder}
    />
  );
}

interface AvailableBackend {
  name: string;
  available: boolean;
}

export const BackendSettingsSection: React.FC<BackendSettingsSectionProps> = ({
  className = "",
}) => {
  const { config, saveConfigSection, errors, showAdvancedSettings, setShowAdvancedSettings } =
    useSettingsStore(
      useShallow((s) => ({
        config: s.config,
        saveConfigSection: s.saveConfigSection,
        errors: s.errors,
        showAdvancedSettings: s.showAdvancedSettings,
        setShowAdvancedSettings: s.setShowAdvancedSettings,
      })),
    );
  const section: ConfigSection = "backend";

  const [availableBackends, setAvailableBackends] = useState<AvailableBackend[]>([]);

  useEffect(() => {
    window.API_RENDERER?.goDaemon
      ?.getBackends?.()
      .then((backends) => {
        setAvailableBackends(backends.map((b) => ({ name: b.name, available: b.available })));
      })
      .catch(() => {});
  }, []);

  const handleChange = async (key: string, value: unknown) => {
    if (key.startsWith("awww.")) {
      const awwwKey = key.replace("awww.", "");
      await saveConfigSection(section, { [awwwKey]: value });
    } else if (key.startsWith("feh.")) {
      const fehKey = key.replace("feh.", "");
      await saveConfigSection(section, { [fehKey]: value });
    } else if (key.startsWith("hyprpaper.")) {
      const hpKey = key.replace("hyprpaper.", "");
      await saveConfigSection(section, { [hpKey]: value });
    } else if (key.startsWith("waylandutauri.")) {
      const wutKey = key.replace("waylandutauri.", "");
      await saveConfigSection(section, { [wutKey]: value });
    } else {
      await saveConfigSection(section, { [key]: value });
    }
  };

  const fieldError = (key: string) =>
    errors.find((e) => e.section === section && e.key === key)?.message;

  const renderField = (field: Field) => {
    let raw: unknown;
    if (field.key === "transition_duration_seconds") {
      raw = effectiveTransitionDurationSeconds(config);
    } else if (field.key.startsWith("awww.")) {
      raw =
        config?.backend?.awww?.[
          field.key.replace("awww.", "") as keyof NonNullable<typeof config.backend.awww>
        ];
    } else if (field.key.startsWith("feh.")) {
      raw =
        config?.backend?.feh?.[
          field.key.replace("feh.", "") as keyof NonNullable<typeof config.backend.feh>
        ];
    } else if (field.key.startsWith("hyprpaper.")) {
      raw =
        config?.backend?.hyprpaper?.[
          field.key.replace("hyprpaper.", "") as keyof NonNullable<typeof config.backend.hyprpaper>
        ];
    } else if (field.key.startsWith("waylandutauri.")) {
      const waylandCfg =
        (config?.backend as unknown as Record<string, unknown>)?.["wayland-utauri"] ??
        (config?.backend as unknown as Record<string, unknown>)?.waylandutauri;
      raw =
        (waylandCfg as Record<string, unknown> | undefined)?.[field.key.replace("waylandutauri.", "")];
    } else {
      raw = config?.backend?.[field.key as keyof typeof config.backend];
    }

    if (field.type === "checkbox") {
      return (
        <SettingRow
          key={field.key}
          label={field.label}
          description={field.description}
          error={fieldError(field.key)}
        >
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={!!raw}
            onChange={(e) => handleChange(field.key, e.target.checked)}
          />
        </SettingRow>
      );
    }

    if (field.type === "select") {
      return (
        <SettingRow
          key={field.key}
          label={field.label}
          description={field.description}
          error={fieldError(field.key)}
        >
          <select
            className={cn(
              "select select-bordered select-sm w-full lg:w-44",
              fieldError(field.key) && "select-error",
            )}
            value={(raw as string) ?? ""}
            onChange={(e) => handleChange(field.key, e.target.value)}
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </SettingRow>
      );
    }

    if (field.type === "number") {
      const useFloatInput =
        field.key === "transition_duration_seconds" ||
        field.key === "waylandutauri.transition_wave_amplitude_percent" ||
        field.key === "waylandutauri.transition_wave_frequency";
      const Input = useFloatInput ? DebouncedFloatInput : DebouncedNumberInput;
      const numValue =
        field.key === "waylandutauri.transition_wave_amplitude_percent"
          ? typeof raw === "number"
            ? raw
            : 5
          : field.key === "waylandutauri.transition_wave_frequency"
            ? typeof raw === "number"
              ? raw
              : 3
            : ((raw as number) ?? 0);
      return (
        <SettingRow
          key={field.key}
          label={field.label}
          description={field.description}
          error={fieldError(field.key)}
        >
          <Input
            className={cn(
              "input input-bordered input-sm w-full lg:w-28",
              fieldError(field.key) && "input-error",
            )}
            value={numValue}
            onCommit={(v) => handleChange(field.key, v)}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        </SettingRow>
      );
    }

    return (
      <SettingRow
        key={field.key}
        label={field.label}
        description={field.description}
        error={fieldError(field.key)}
      >
        <DebouncedTextInput
          className={cn(
            "input input-bordered input-sm w-full lg:w-48",
            fieldError(field.key) && "input-error",
          )}
          value={(raw as string) ?? ""}
          onCommit={(v) => handleChange(field.key, v)}
          placeholder={field.placeholder}
        />
      </SettingRow>
    );
  };

  const backendType = config?.backend?.type;

  return (
    <div className={cn("space-y-0", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-base-content mb-1">Backend</h2>
          <p className="text-sm text-base-content/50">Wallpaper backend and transition settings.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-base-content/50">Advanced</span>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showAdvancedSettings}
            onChange={(e) => setShowAdvancedSettings(e.target.checked)}
          />
        </label>
      </div>

      {/* ── General ────────────────────────────────────── */}
      <SettingSectionHeader title="General" />

      <SettingRow
        label="Backend Type"
        description="Wallpaper backend to use for setting wallpapers"
        error={fieldError("type")}
      >
        <select
          className={cn(
            "select select-bordered select-sm w-44",
            fieldError("type") && "select-error",
          )}
          value={(backendType as string) ?? "awww"}
          onChange={(e) => handleChange("type", e.target.value)}
        >
          {availableBackends.length > 0 ? (
            availableBackends.map((b) => (
              <option key={b.name} value={b.name} disabled={!b.available}>
                {b.name}
                {!b.available ? " (not installed)" : ""}
              </option>
            ))
          ) : (
            <option value={backendType ?? "awww"}>{backendType ?? "awww"}</option>
          )}
        </select>
      </SettingRow>

      {/* ── awww settings ───────────────────────────────── */}
      {backendType === "awww" && (
        <>
          <SettingSectionHeader title="Image Display" />
          {awwwDisplayFields.map(renderField)}
          <SettingSectionHeader title="Transitions" />
          {renderField(transitionDurationSharedField)}
          {awwwTransitionFields.map(renderField)}
        </>
      )}

      {/* ── feh settings ──────────────────────────────────── */}
      {backendType === "feh" && (
        <>
          <SettingSectionHeader title="Image Display" />
          {fehDisplayFields.map(renderField)}
        </>
      )}

      {/* ── hyprpaper settings ─────────────────────────────── */}
      {backendType === "hyprpaper" && (
        <>
          <SettingSectionHeader title="Image Display" />
          {hyprpaperDisplayFields.map(renderField)}
          {showAdvancedSettings && (
            <>
              <SettingSectionHeader title="Advanced" />
              {hyprpaperAdvancedFields.map(renderField)}
            </>
          )}
        </>
      )}

      {backendType === "wayland-utauri" && (
        <>
          <SettingSectionHeader title="Transitions" />
          {renderField(transitionDurationSharedField)}
          {waylandUtauriTransitionFields.map(renderField)}
          <SettingSectionHeader title="Parallax" />
          {waylandUtauriParallaxFields.map(renderField)}
          <SettingSectionHeader title="Video" />
          {waylandUtauriVideoFields.map(renderField)}
          {showAdvancedSettings && (
            <>
              <SettingSectionHeader title="Advanced" />
              {waylandUtauriAdvancedFields.map(renderField)}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BackendSettingsSection;
