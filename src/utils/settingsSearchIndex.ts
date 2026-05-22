import type { ConfigSection } from "@/shared/types/unifiedConfig";

export interface SettingsSearchEntry {
  section: ConfigSection;
  key: string;
  label: string;
  description: string;
  category: string;
}

function normalizeTokens(raw: string): string[] {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function entryHaystack(e: SettingsSearchEntry): string {
  return `${e.label} ${e.description} ${e.key} ${e.category}`.toLowerCase();
}

/** Row matches when every whitespace token appears somewhere in label/description/key/category. */
export function entryMatchesSettingsSearchQuery(
  entry: SettingsSearchEntry,
  rawQuery: string,
): boolean {
  const tokens = normalizeTokens(rawQuery);
  if (tokens.length === 0) return false;
  const hay = entryHaystack(entry);
  return tokens.every((t) => hay.includes(t));
}

/**
 * Sections where each query token hits at least one indexed row in that section
 * (token may hit different rows).
 */
export function sectionsMatchingSettingsSearchQuery(rawQuery: string): ConfigSection[] {
  const tokens = normalizeTokens(rawQuery);
  if (tokens.length === 0) return [];

  const bySection = new Map<ConfigSection, SettingsSearchEntry[]>();
  for (const e of SETTINGS_SEARCH_ENTRIES) {
    const list = bySection.get(e.section) ?? [];
    list.push(e);
    bySection.set(e.section, list);
  }

  const order: ConfigSection[] = ["app", "daemon", "backend", "monitors", "wallhaven"];
  const out: ConfigSection[] = [];
  for (const section of order) {
    const rows = bySection.get(section);
    if (!rows) continue;
    const haystacks = rows.map(entryHaystack);
    const ok = tokens.every((t) => haystacks.some((h) => h.includes(t)));
    if (ok) out.push(section);
  }
  return out;
}

/** Filtered list for the settings search dropdown (same token semantics as the store). */
export function filterSettingsSearchEntries(rawQuery: string): SettingsSearchEntry[] {
  if (!rawQuery.trim()) return [];
  return SETTINGS_SEARCH_ENTRIES.filter((e) => entryMatchesSettingsSearchQuery(e, rawQuery));
}

const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  {
    section: "app",
    key: "_nav",
    label: "General",
    description: "Application settings, theme, and gallery defaults",
    category: "General",
  },
  {
    section: "daemon",
    key: "_nav",
    label: "Daemon",
    description: "Daemon paths, database, and logging settings",
    category: "Daemon",
  },
  {
    section: "backend",
    key: "_nav",
    label: "Backend settings",
    description: "Wallpaper backend type, auto mode, and transition options",
    category: "Backend",
  },
  {
    section: "wallhaven",
    key: "enabled",
    label: "Wallhaven",
    description: "Enable Wallhaven browsing and API integration",
    category: "Integrations",
  },
  {
    section: "wallhaven",
    key: "api_key",
    label: "Wallhaven API key",
    description: "API key for wallhaven.cc",
    category: "Integrations",
  },
  {
    section: "app",
    key: "theme",
    label: "Theme",
    description: "Application theme",
    category: "Appearance",
  },
  {
    section: "app",
    key: "font_preset",
    label: "Typography",
    description: "Font preset bundled Kolision Google Sans system custom typography",
    category: "Appearance",
  },
  {
    section: "app",
    key: "font_family_body",
    label: "Custom body font",
    description: "CSS font stack for body text when typography preset is custom",
    category: "Appearance",
  },
  {
    section: "app",
    key: "font_family_display",
    label: "Custom display font",
    description: "CSS font stack for headings when typography preset is custom",
    category: "Appearance",
  },
  {
    section: "app",
    key: "font_family_mono",
    label: "Custom monospace font",
    description: "CSS font stack for monospace when typography preset is custom",
    category: "Appearance",
  },
  {
    section: "app",
    key: "notifications",
    label: "Notifications",
    description: "Enable desktop notifications",
    category: "Appearance",
  },
  {
    section: "app",
    key: "start_minimized",
    label: "Start Minimized",
    description: "Start application minimized",
    category: "Behavior",
  },
  {
    section: "app",
    key: "minimize_instead_of_close",
    label: "Minimize Instead of Close",
    description: "Minimize to tray instead of closing",
    category: "Behavior",
  },
  {
    section: "app",
    key: "images_per_page",
    label: "Images Per Page",
    description: "Number of images per page",
    category: "Gallery",
  },
  {
    section: "app",
    key: "sort_by",
    label: "Sort By",
    description: "Default sort order for images",
    category: "Gallery",
  },
  {
    section: "daemon",
    key: "log_level",
    label: "Log Level",
    description: "Daemon logging level",
    category: "Logging",
  },
  {
    section: "daemon",
    key: "log_file",
    label: "Log File",
    description: "Path to log file",
    category: "Logging",
  },
  {
    section: "daemon",
    key: "images_dir",
    label: "Images Directory",
    description: "Directory for cached images",
    category: "Storage",
  },
  {
    section: "daemon",
    key: "thumbnails_dir",
    label: "Thumbnails Directory",
    description: "Directory for thumbnails",
    category: "Storage",
  },
  {
    section: "backend",
    key: "type",
    label: "Backend Type",
    description: "Wallpaper backend (awww, feh, etc.)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "selection_mode",
    label: "Selection Mode",
    description: "Fixed (one backend) or Auto (pick per media type)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "auto_priorities",
    label: "Auto Backend Priorities",
    description: "Per-media backend priority lists for auto mode",
    category: "Backend",
  },
  {
    section: "backend",
    key: "awww.transition_type",
    label: "Transition Type",
    description: "Type of wallpaper transition",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "awww.transition_duration",
    label: "Awww transition duration",
    description: "awww transition length in seconds",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.duration_ms",
    label: "wal-qt transition duration",
    description: "wal-qt transition length in seconds",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.transition",
    label: "wal-qt transition",
    description: "Transition preset for wal-qt",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.image_fit_mode",
    label: "wal-qt image fit mode",
    description: "CSS object-fit mode for image wallpapers",
    category: "Image Display",
  },
  {
    section: "backend",
    key: "walqt.image_rendering",
    label: "wal-qt image rendering",
    description: "CSS image-rendering hint for image wallpapers",
    category: "Image Display",
  },
  {
    section: "backend",
    key: "walqt.fill_color",
    label: "wal-qt fill color",
    description:
      "Padding color when the image does not fully cover the monitor (RRGGBB / RRGGBBAA hex)",
    category: "Image Display",
  },
  {
    section: "backend",
    key: "walqt.transition_angle_deg",
    label: "Wipe / wave angle",
    description: "Angle in degrees for wipe and wave (directional presets lock angle)",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.transition_origin_x_percent",
    label: "Grow/outer origin X",
    description: "Horizontal origin percent for grow and outer transitions",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.transition_origin_y_percent",
    label: "Grow/outer origin Y",
    description: "Vertical origin percent for grow and outer transitions",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "walqt.parallax_compositor_driver",
    label: "Compositor parallax driver",
    description:
      "Hyprland/Sway: workspace changes send POST /wallpaper/parallax-move (step from parallax step %)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "walqt.parallax_workspace_chunk_size",
    label: "Parallax workspace chunk size",
    description:
      "Ring period for workspace IDs when mapping switches to parallax left/right (Hyprland/Sway driver)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "walqt.parallax_step_percent",
    label: "Parallax step",
    description:
      "Per-move offset in % (POST /wallpaper/parallax step_percent; each workspace switch is one parallax-move)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "walqt.parallax_reset_ms",
    label: "Parallax reset duration",
    description: "Milliseconds when parallax disables or snaps back (reset_ms to wal-qt)",
    category: "Backend",
  },
  {
    section: "backend",
    key: "awww.transition_step",
    label: "Transition Step",
    description: "Step size for transitions",
    category: "Transitions",
  },
  {
    section: "monitors",
    key: "_nav",
    label: "Monitors",
    description: "Monitor selection and multi-monitor wallpaper behavior",
    category: "Monitors",
  },
  {
    section: "monitors",
    key: "image_set_type",
    label: "Image Set Type",
    description: "How images are set across monitors",
    category: "Monitors",
  },
  {
    section: "monitors",
    key: "selected_monitors",
    label: "Selected Monitors",
    description: "Monitors to use for wallpapers",
    category: "Monitors",
  },
];
