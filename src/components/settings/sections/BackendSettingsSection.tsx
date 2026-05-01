import type React from "react";
import { useState, useEffect, useRef, useCallback, Fragment, useMemo } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection, UnifiedConfig } from "@/shared/types/unifiedConfig";
import { FIELD_PREFIX_BY_BACKEND } from "@/utils/backendFieldPrefixes";
import {
  readPersistedBackendSettingsPanel,
  writePersistedBackendSettingsPanel,
} from "@/utils/settingsNavStorage";
import { daemonClient } from "@/client";

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
    key: "awww.transition_duration",
    label: "Transition duration (seconds)",
    description:
      "Length of awww transition animations (seconds). Passed to awww as --transition-duration.",
    type: "number",
    min: 0,
    max: 120,
    step: 0.1,
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

const mpvpaperFields: Field[] = [
  {
    key: "mpvpaper.mpv_options",
    label: "mpv options",
    description:
      'Forwarded to mpvpaper -o (e.g. "loop"). When a video has audio disabled, "no-audio" is prepended automatically.',
    type: "text",
    placeholder: "loop",
  },
  {
    key: "mpvpaper.verbose",
    label: "Verbosity",
    description: "0 = off, 1 = mpvpaper -v, 2 = -vv",
    type: "number",
    min: 0,
    max: 2,
    step: 1,
  },
  {
    key: "mpvpaper.auto_pause",
    label: "Auto-pause when hidden (-p)",
    description: "Ask mpvpaper to pause mpv when the wallpaper surface is hidden (best-effort)",
    type: "checkbox",
  },
  {
    key: "mpvpaper.auto_stop",
    label: "Auto-stop when hidden (-s)",
    description:
      "Ask mpvpaper to stop mpv when hidden; saves more resources than pause (best-effort)",
    type: "checkbox",
  },
  {
    key: "mpvpaper.layer",
    label: "Layer (-l)",
    description: "Optional wlroots layer-shell layer name (leave empty for mpvpaper default)",
    type: "text",
    placeholder: "",
  },
  {
    key: "mpvpaper.slideshow_secs",
    label: "Slideshow interval (seconds)",
    description: "If greater than 0, passes mpvpaper -n (slideshow mode). 0 disables.",
    type: "number",
    min: 0,
    max: 86400,
    step: 1,
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
    key: "waylandutauri.duration_ms",
    label: "Transition duration (seconds)",
    description:
      "How long image transitions run in wayland-utauri. Saved as milliseconds in the daemon config.",
    type: "number",
    min: 0,
    max: 120,
    step: 0.1,
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

const waylandUtauriImageFields: Field[] = [
  {
    key: "waylandutauri.image_fit_mode",
    label: "Image fit mode",
    description: "CSS object-fit mode for image wallpapers.",
    type: "select",
    options: [
      { value: "fill", label: "Fill (stretch)" },
      { value: "contain", label: "Contain (letterbox)" },
      { value: "cover", label: "Cover (crop to fill)" },
      { value: "none", label: "None (no scaling)" },
      { value: "scale-down", label: "Scale-down (none or contain)" },
    ],
  },
  {
    key: "waylandutauri.image_rendering",
    label: "Image rendering",
    description: "CSS image-rendering hint for image wallpapers.",
    type: "select",
    options: [
      { value: "auto", label: "Auto" },
      { value: "smooth", label: "Smooth" },
      { value: "high-quality", label: "High quality" },
      { value: "crisp-edges", label: "Crisp edges" },
      { value: "pixelated", label: "Pixelated" },
    ],
  },
];

const waylandUtauriParallaxFields: Field[] = [
  {
    key: "waylandutauri.parallax_enabled",
    label: "Enable parallax",
    description:
      "Syncs parallax to wayland-utauri (POST /wallpaper/parallax: zoom, step, animation, easing, reset). The compositor driver sends one parallax-move per workspace change; offsets accumulate and wal-utauri elastic-wraps past ±0.5.",
    type: "checkbox",
  },
  {
    key: "waylandutauri.parallax_compositor_driver",
    label: "Compositor parallax driver",
    description:
      "Hyprland/Sway: follow workspace focus and POST /wallpaper/parallax-move (direction only; amount uses Parallax step below). “Off” disables; “Auto” picks Hyprland or Sway from the session.",
    type: "select",
    options: [
      { value: "auto", label: "Auto" },
      { value: "off", label: "Off" },
      { value: "hyprland", label: "Hyprland" },
      { value: "sway", label: "Sway" },
    ],
  },
  {
    key: "waylandutauri.parallax_workspace_chunk_size",
    label: "Workspace ID ring (chunk size)",
    description:
      "Hyprland/Sway only: when deciding left vs right (or up vs down), workspace IDs are treated as wrapping on a ring of this many steps—shortest path wins (e.g. set close to your number of workspaces if IDs wrap).",
    type: "number",
    min: 1,
    max: 64,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_step_percent",
    label: "Parallax step (%)",
    description:
      "Per parallax-move: how much normalized offset to add in wal-utauri (sent in /wallpaper/parallax as step_percent; each compositor workspace switch triggers one move).",
    type: "number",
    min: 1,
    max: 50,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_direction",
    label: "Workspace parallax axis",
    description:
      "Hyprland/Sway: map workspace transitions to horizontal pan (left/right) or vertical (up/down). Per-wallpaper waypaper.json can override with parallax_direction.",
    type: "select",
    options: [
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
    ],
  },
  {
    key: "waylandutauri.parallax_zoom",
    label: "Parallax zoom (%)",
    description:
      "Scale factor in /wallpaper/parallax (100% = 1.0; higher values zoom in so small offset steps show as visible pan).",
    type: "number",
    min: 100,
    max: 200,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_animation_ms",
    label: "Parallax animation (ms)",
    description:
      "animation_ms in /wallpaper/parallax: transition duration when offsets update (wallpaper:parallax in the webview).",
    type: "number",
    min: 16,
    max: 5000,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_reset_ms",
    label: "Parallax reset (ms)",
    description:
      "reset_ms in /wallpaper/parallax: duration when parallax is disabled or wal-utauri elastic-snaps offset to center.",
    type: "number",
    min: 16,
    max: 10000,
    step: 1,
  },
  {
    key: "waylandutauri.parallax_easing",
    label: "Parallax easing",
    description: "Cubic-bezier control points as x1,y1,x2,y2 for parallax transitions.",
    type: "text",
    placeholder: "0.215,0.610,0.355,1.000",
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
      "Global gate for outbound fetch/XHR/WebSocket on HTML wallpapers (WebKit relaxes policy when allowed). Per-wallpaper `capabilities.network` in waypaper.json must also be enabled. Applied immediately via wayland-utauri (webview reload).",
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
  const [prevExternal, setPrevExternal] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (externalValue !== prevExternal) {
    setPrevExternal(externalValue);
    setLocal(String(externalValue));
  }

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
  const [prevExternal, setPrevExternal] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (externalValue !== prevExternal) {
    setPrevExternal(externalValue);
    setLocal(String(externalValue));
  }

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

function getBackendSubconfig(
  config: UnifiedConfig | null,
  backendId: string,
): Record<string, unknown> | undefined {
  if (!config?.backend) return undefined;
  const b = config.backend as unknown as Record<string, unknown>;
  if (backendId === "wayland-utauri") {
    const w = b["wayland-utauri"] ?? b.waylandutauri;
    return w && typeof w === "object" ? (w as Record<string, unknown>) : undefined;
  }
  const sub = b[backendId];
  return sub && typeof sub === "object" && !Array.isArray(sub)
    ? (sub as Record<string, unknown>)
    : undefined;
}

function patchKeyForField(field: Field, backendId: string): string {
  const prefix = FIELD_PREFIX_BY_BACKEND[backendId];
  if (prefix && field.key.startsWith(prefix)) {
    return field.key.slice(prefix.length);
  }
  return field.key;
}

type BackendFieldGroup = { title: string; fields: Field[] };

function fieldGroupsForBackend(backendId: string): BackendFieldGroup[] {
  switch (backendId) {
    case "awww":
      return [
        { title: "Image Display", fields: awwwDisplayFields },
        { title: "Transitions", fields: awwwTransitionFields },
      ];
    case "feh":
      return [{ title: "Image Display", fields: fehDisplayFields }];
    case "hyprpaper":
      return [
        { title: "Image Display", fields: hyprpaperDisplayFields },
        { title: "Advanced", fields: hyprpaperAdvancedFields },
      ];
    case "mpvpaper":
      return [{ title: "Video (Wayland)", fields: mpvpaperFields }];
    case "wayland-utauri":
      return [
        { title: "Image Display", fields: waylandUtauriImageFields },
        { title: "Transitions", fields: waylandUtauriTransitionFields },
        { title: "Parallax", fields: waylandUtauriParallaxFields },
        { title: "Video", fields: waylandUtauriVideoFields },
        { title: "Advanced", fields: waylandUtauriAdvancedFields },
      ];
    default:
      return [];
  }
}

interface AvailableBackend {
  name: string;
  available: boolean;
}

const MEDIA_CATEGORIES = ["image", "video", "web"] as const;
type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  image: "Image / GIF",
  video: "Video",
  web: "Web",
};

const BACKEND_MEDIA_SUPPORT: Record<string, MediaCategory[]> = {
  awww: ["image"],
  hyprpaper: ["image"],
  feh: ["image"],
  "wayland-utauri": ["image", "video", "web"],
  mpvpaper: ["video"],
};

function backendsForCategory(
  category: MediaCategory,
  available: AvailableBackend[],
): AvailableBackend[] {
  return available.filter((b) => BACKEND_MEDIA_SUPPORT[b.name]?.includes(category));
}

function PriorityList({
  category,
  items,
  available,
  onChange,
}: {
  category: MediaCategory;
  items: string[];
  available: AvailableBackend[];
  onChange: (newOrder: string[]) => void;
}) {
  const eligible = backendsForCategory(category, available);
  const eligibleNames = new Set(eligible.map((b) => b.name));

  const normalized = [
    ...items.filter((name) => eligibleNames.has(name)),
    ...eligible.map((b) => b.name).filter((name) => !items.includes(name)),
  ];

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...normalized];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-base-content/60">{CATEGORY_LABELS[category]}</div>
      <div className="flex flex-col gap-0.5">
        {normalized.map((name, i) => {
          const isAvailable = eligible.find((b) => b.name === name)?.available ?? false;
          return (
            <div
              key={name}
              className="flex items-center gap-1.5 rounded px-2 py-1 bg-base-200/60 text-sm"
            >
              <span className="tabular-nums text-xs text-base-content/40 w-4 text-right">
                {i + 1}
              </span>
              <span
                className={cn(
                  "flex-1 truncate",
                  !isAvailable && "text-base-content/40 line-through",
                )}
              >
                {name}
                {!isAvailable && " (unavailable)"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs px-1"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${name} up`}
              >
                ▲
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs px-1"
                disabled={i === normalized.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${name} down`}
              >
                ▼
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const BackendSettingsSection: React.FC<BackendSettingsSectionProps> = ({
  className = "",
}) => {
  const {
    config,
    saveConfigSection,
    saveBackendPatch,
    errors,
    pendingBackendSettingsTab,
    clearPendingBackendSettingsTab,
  } = useSettingsStore(
    useShallow((s) => ({
      config: s.config,
      saveConfigSection: s.saveConfigSection,
      saveBackendPatch: s.saveBackendPatch,
      errors: s.errors,
      pendingBackendSettingsTab: s.pendingBackendSettingsTab,
      clearPendingBackendSettingsTab: s.clearPendingBackendSettingsTab,
    })),
  );
  const section: ConfigSection = "backend";

  const [availableBackends, setAvailableBackends] = useState<AvailableBackend[]>([]);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"general" | string>(
    () => readPersistedBackendSettingsPanel() ?? "general",
  );

  const selectBackendPanel = useCallback((tab: string) => {
    setActiveSettingsTab(tab);
    writePersistedBackendSettingsPanel(tab);
  }, []);

  useEffect(() => {
    if (pendingBackendSettingsTab === null) return;
    selectBackendPanel(pendingBackendSettingsTab);
    clearPendingBackendSettingsTab();
  }, [pendingBackendSettingsTab, selectBackendPanel, clearPendingBackendSettingsTab]);

  useEffect(() => {
    daemonClient
      .getBackends()
      .then((backends) => {
        const mapped = backends.map((b) => ({
          name: b.name,
          available: b.available,
        }));
        setAvailableBackends(mapped);
        setActiveSettingsTab((tab) => {
          if (tab === "general") return tab;
          if (mapped.some((b) => b.name === tab)) return tab;
          writePersistedBackendSettingsPanel("general");
          return "general";
        });
      })
      .catch(() => {});
  }, []);

  const sortedBackends = useMemo(
    () => [...availableBackends].sort((a, b) => a.name.localeCompare(b.name)),
    [availableBackends],
  );

  const fieldError = (key: string) =>
    errors.find((e) => e.section === section && e.key === key)?.message;

  const backendFieldError = (backendId: string, field: Field) => {
    const pk = patchKeyForField(field, backendId);
    return errors.find((e) => e.section === section && e.key === `${backendId}:${pk}`)?.message;
  };

  const handleTopLevelChange = async (key: string, value: unknown) => {
    await saveConfigSection(section, { [key]: value });
  };

  const renderAnyField = (
    field: Field,
    raw: unknown,
    err: string | undefined,
    commit: (value: unknown) => void,
  ) => {
    if (field.type === "checkbox") {
      return (
        <SettingRow key={field.key} label={field.label} description={field.description} error={err}>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={!!raw}
            onChange={(e) => void commit(e.target.checked)}
          />
        </SettingRow>
      );
    }

    if (field.type === "select") {
      return (
        <SettingRow key={field.key} label={field.label} description={field.description} error={err}>
          <select
            className={cn("select select-bordered select-sm w-full lg:w-44", err && "select-error")}
            value={(raw as string) ?? ""}
            onChange={(e) => void commit(e.target.value)}
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
        field.key === "awww.transition_duration" ||
        field.key === "waylandutauri.duration_ms" ||
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
        <SettingRow key={field.key} label={field.label} description={field.description} error={err}>
          <Input
            className={cn("input input-bordered input-sm w-full lg:w-28", err && "input-error")}
            value={numValue}
            onCommit={(v) => void commit(v)}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        </SettingRow>
      );
    }

    return (
      <SettingRow key={field.key} label={field.label} description={field.description} error={err}>
        <DebouncedTextInput
          className={cn("input input-bordered input-sm w-full lg:w-48", err && "input-error")}
          value={(raw as string) ?? ""}
          onCommit={(v) => void commit(v)}
          placeholder={field.placeholder}
        />
      </SettingRow>
    );
  };

  const renderBackendField = (field: Field, backendId: string) => {
    const pk = patchKeyForField(field, backendId);
    const sub = getBackendSubconfig(config, backendId);

    if (backendId === "wayland-utauri" && pk === "duration_ms") {
      const ms = sub?.duration_ms;
      const seconds = typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? ms / 1000 : 0.3;
      return renderAnyField(field, seconds, backendFieldError(backendId, field), (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        const clamped = Math.min(120, Math.max(0, n));
        void saveBackendPatch(backendId, {
          duration_ms: Math.round(clamped * 1000),
        });
      });
    }

    const raw = sub?.[pk];
    return renderAnyField(field, raw, backendFieldError(backendId, field), (value) => {
      void saveBackendPatch(backendId, { [pk]: value });
    });
  };

  const backendType = config?.backend?.type;
  const selectionMode = config?.backend?.selection_mode ?? "fixed";
  const autoPriorities = config?.backend?.auto_priorities ?? {
    image: ["awww", "hyprpaper", "feh", "wayland-utauri"],
    video: ["mpvpaper", "wayland-utauri"],
    web: ["wayland-utauri"],
  };

  const handlePriorityChange = (category: MediaCategory, newOrder: string[]) => {
    void handleTopLevelChange("auto_priorities", {
      ...autoPriorities,
      [category]: newOrder,
    });
  };

  const activeBackendMeta = sortedBackends.find((b) => b.name === activeSettingsTab);
  const backendGroups =
    activeSettingsTab !== "general" ? fieldGroupsForBackend(activeSettingsTab) : [];

  return (
    <div className={cn("space-y-0", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-base-content mb-1">Backend</h2>
        <p className="text-sm text-base-content/50">Wallpaper backend and transition settings.</p>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <label className="form-control w-full max-w-xs lg:hidden">
          <span className="label-text text-xs text-base-content/60">Panel</span>
          <select
            className="select select-bordered select-sm w-full"
            value={activeSettingsTab}
            onChange={(e) => selectBackendPanel(e.target.value)}
          >
            <option value="general">General</option>
            {sortedBackends.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {!b.available ? " (not installed)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div
          role="tablist"
          className="tabs tabs-boxed w-full overflow-x-auto hidden lg:flex flex-nowrap"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === "general"}
            className={cn("tab", activeSettingsTab === "general" && "tab-active")}
            onClick={() => selectBackendPanel("general")}
          >
            General
          </button>
          {sortedBackends.map((b) => (
            <button
              type="button"
              key={b.name}
              role="tab"
              aria-selected={activeSettingsTab === b.name}
              className={cn("tab whitespace-nowrap", activeSettingsTab === b.name && "tab-active")}
              onClick={() => selectBackendPanel(b.name)}
            >
              {b.name}
              {!b.available && (
                <span className="badge badge-warning badge-xs ml-1 align-middle">off</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeSettingsTab === "general" && (
        <>
          <SettingSectionHeader title="General" />

          <SettingRow
            label="Selection Mode"
            description="Fixed uses one backend for everything. Auto picks the best backend per media type using priority lists below."
          >
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "btn btn-sm",
                  selectionMode === "fixed" ? "btn-primary" : "btn-ghost",
                )}
                onClick={() => void handleTopLevelChange("selection_mode", "fixed")}
              >
                Fixed
              </button>
              <button
                type="button"
                className={cn("btn btn-sm", selectionMode === "auto" ? "btn-primary" : "btn-ghost")}
                onClick={() => void handleTopLevelChange("selection_mode", "auto")}
              >
                Auto
              </button>
            </div>
          </SettingRow>

          <SettingRow
            label={selectionMode === "auto" ? "Startup Backend" : "Backend Type"}
            description={
              selectionMode === "auto"
                ? "Backend activated on startup. Auto mode will switch away as needed per media type."
                : "Wallpaper backend to use for setting wallpapers"
            }
            error={fieldError("type")}
          >
            {backendType != null ? (
              <select
                className={cn(
                  "select select-bordered select-sm w-44",
                  fieldError("type") && "select-error",
                )}
                value={backendType as string}
                onChange={(e) => void handleTopLevelChange("type", e.target.value)}
              >
                {availableBackends.length > 0 ? (
                  availableBackends.map((b) => (
                    <option key={b.name} value={b.name} disabled={!b.available}>
                      {b.name}
                      {!b.available ? " (not installed)" : ""}
                    </option>
                  ))
                ) : (
                  <option value={backendType as string}>{backendType as string}</option>
                )}
              </select>
            ) : (
              <span className="text-xs text-base-content/40">Loading…</span>
            )}
          </SettingRow>

          {selectionMode === "auto" && (
            <>
              <SettingSectionHeader
                title="Auto Backend Priorities"
                description="For each media type, backends are tried in order. The first available and compatible backend is used. Switching backends mid-session has a small overhead."
              />
              <SettingRow
                label="Priority Lists"
                description="Reorder backends per media type. Higher priority backends are tried first."
                stacked
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  {MEDIA_CATEGORIES.map((cat) => (
                    <PriorityList
                      key={cat}
                      category={cat}
                      items={autoPriorities[cat] ?? []}
                      available={availableBackends}
                      onChange={(newOrder) => handlePriorityChange(cat, newOrder)}
                    />
                  ))}
                </div>
              </SettingRow>
            </>
          )}
        </>
      )}

      {activeSettingsTab !== "general" && (
        <>
          {activeBackendMeta && !activeBackendMeta.available && (
            <div className="alert alert-warning text-sm mb-4">
              This backend is not installed or unavailable on this system. You can still edit saved
              options.
            </div>
          )}
          {backendGroups.length === 0 ? (
            <p className="text-sm text-base-content/60">
              No settings are defined for “{activeSettingsTab}” in the UI yet.
            </p>
          ) : (
            backendGroups.map((g) => (
              <Fragment key={g.title}>
                <SettingSectionHeader title={g.title} />
                {g.fields.map((f) => renderBackendField(f, activeSettingsTab))}
              </Fragment>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default BackendSettingsSection;
