import type React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

interface SettingsSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClear: () => void;
  onNavigateToSection?: (section: ConfigSection) => void;
  className?: string;
  placeholder?: string;
  showSuggestions?: boolean;
  /** Compact variant for sidebar usage */
  compact?: boolean;
}

interface SearchSuggestion {
  section: ConfigSection;
  key: string;
  label: string;
  description: string;
  category: string;
}

const searchSuggestions: SearchSuggestion[] = [
  {
    section: "app",
    key: "theme",
    label: "Theme",
    description: "Application theme",
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
    key: "awww.transition_type",
    label: "Transition Type",
    description: "Type of wallpaper transition",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "transition_duration_seconds",
    label: "Transition duration",
    description: "Wallpaper transition length in seconds (awww and wayland-utauri)",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "waylandutauri.transition",
    label: "Wayland-utauri transition",
    description: "Transition preset for wayland-utauri / waypaper-tauri",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "waylandutauri.transition_angle_deg",
    label: "Wipe / wave angle",
    description: "Angle in degrees for wipe and wave (directional presets lock angle)",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "waylandutauri.transition_origin_x_percent",
    label: "Grow/outer origin X",
    description: "Horizontal origin percent for grow and outer transitions",
    category: "Transitions",
  },
  {
    section: "backend",
    key: "waylandutauri.transition_origin_y_percent",
    label: "Grow/outer origin Y",
    description: "Vertical origin percent for grow and outer transitions",
    category: "Transitions",
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

export const SettingsSearch: React.FC<SettingsSearchProps> = ({
  searchTerm,
  onSearchChange,
  onSearchClear,
  onNavigateToSection,
  className = "",
  placeholder = "Search settings...",
  showSuggestions = true,
  compact = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [prevTerm, setPrevTerm] = useState(searchTerm);

  const filtered = searchTerm.trim()
    ? searchSuggestions.filter(
        (s) =>
          s.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : [];

  if (prevTerm !== searchTerm) {
    setPrevTerm(searchTerm);
    setSelectedIdx(-1);
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) {
      if (event.key === "Enter" && onNavigateToSection) {
        event.preventDefault();
        const lc = searchTerm.toLowerCase();
        let target: ConfigSection | null = null;
        if (lc.includes("app") || lc.includes("theme") || lc.includes("notification"))
          target = "app";
        else if (lc.includes("daemon") || lc.includes("log") || lc.includes("database"))
          target = "daemon";
        else if (lc.includes("backend") || lc.includes("awww") || lc.includes("transition"))
          target = "backend";
        if (target) {
          onNavigateToSection(target);
          inputRef.current?.blur();
        }
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIdx((p) => (p < filtered.length - 1 ? p + 1 : p));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIdx((p) => (p > 0 ? p - 1 : -1));
        break;
      case "Enter":
        event.preventDefault();
        if (selectedIdx >= 0) {
          onSearchChange(filtered[selectedIdx].key);
          inputRef.current?.blur();
        } else if (onNavigateToSection && filtered[0]) {
          onNavigateToSection(filtered[0].section);
          inputRef.current?.blur();
        }
        break;
      case "Escape":
        event.preventDefault();
        onSearchClear();
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    if (selectedIdx >= 0 && suggestionsRef.current) {
      const el = suggestionsRef.current.children[selectedIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <svg
            className="h-3.5 w-3.5 text-base-content/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "input input-bordered w-full pl-8 pr-8",
            compact ? "input-sm text-xs" : "focus:input-primary",
            isFocused && !compact && "ring-2 ring-primary/20",
          )}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        />
        {searchTerm && (
          <button
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center hover:text-base-content/60 transition-colors"
            onClick={() => {
              onSearchClear();
              inputRef.current?.focus();
            }}
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {showSuggestions && isFocused && filtered.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {filtered.map((s, i) => (
            <button
              key={`${s.section}-${s.key}`}
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-base-200 transition-colors border-b border-base-200 last:border-b-0",
                i === selectedIdx && "bg-primary/10",
              )}
              onClick={() => {
                onSearchChange(s.key);
                inputRef.current?.blur();
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">{s.label}</span>
                <span className="text-[10px] text-base-content/60 bg-base-200 px-1.5 py-0.5 rounded">
                  {s.category}
                </span>
              </div>
              {!compact && (
                <p className="text-[10px] text-base-content/50 mt-0.5 truncate">{s.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SettingsSearch;
