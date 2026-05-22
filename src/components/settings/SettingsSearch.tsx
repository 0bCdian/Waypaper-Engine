import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/utils/cn";
import type { ConfigSection } from "@/shared/types/unifiedConfig";
import { filterSettingsSearchEntries, type SettingsSearchEntry } from "@/utils/settingsSearchIndex";

interface SettingsSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClear: () => void;
  onNavigateToSection?: (section: ConfigSection, searchEntry?: SettingsSearchEntry) => void;
  className?: string;
  placeholder?: string;
  showSuggestions?: boolean;
  /** Compact variant for sidebar usage */
  compact?: boolean;
}

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
  const [navState, setNavState] = useState<{ idx: number; term: string }>({
    idx: -1,
    term: searchTerm,
  });
  const selectedIdx = navState.term === searchTerm ? navState.idx : -1;
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filtered = filterSettingsSearchEntries(searchTerm);

  const setSelectedIdx = useCallback(
    (updater: number | ((prev: number) => number)) => {
      setNavState((prev) => {
        const prevIdx = prev.term === searchTerm ? prev.idx : -1;
        const nextIdx = typeof updater === "function" ? updater(prevIdx) : updater;
        return { idx: nextIdx, term: searchTerm };
      });
    },
    [searchTerm],
  );

  const commitNavigate = (section: ConfigSection, searchEntry?: SettingsSearchEntry) => {
    if (!onNavigateToSection) return;
    onNavigateToSection(section, searchEntry);
    onSearchClear();
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) {
      if (event.key === "Enter" && onNavigateToSection) {
        event.preventDefault();
        const lc = searchTerm.toLowerCase();
        let target: ConfigSection | null = null;
        if (lc.includes("wallhaven")) target = "wallhaven";
        else if (lc.includes("monitor")) target = "monitors";
        else if (lc.includes("app") || lc.includes("theme") || lc.includes("notification"))
          target = "app";
        else if (lc.includes("daemon") || lc.includes("log") || lc.includes("database"))
          target = "daemon";
        else if (lc.includes("backend") || lc.includes("awww") || lc.includes("transition"))
          target = "backend";
        if (target) {
          const entryForSection =
            target === "backend" ? filtered.find((e) => e.section === "backend") : undefined;
          commitNavigate(target, entryForSection);
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
        if (selectedIdx >= 0 && onNavigateToSection) {
          const e = filtered[selectedIdx];
          commitNavigate(e.section, e);
        } else if (onNavigateToSection && filtered[0]) {
          const e = filtered[0];
          commitNavigate(e.section, e);
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
            className="size-3.5"
            style={{ color: "var(--wp-text-faint)" }}
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
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center hover:text-base-content transition-colors"
            onClick={() => {
              onSearchClear();
              inputRef.current?.focus();
            }}
            type="button"
          >
            <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-base-200 transition-colors border-b border-base-200 last:border-b-0",
                i === selectedIdx && "bg-primary/10",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (onNavigateToSection) commitNavigate(s.section, s);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">{s.label}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: "var(--wp-text-muted)",
                    backgroundColor: "var(--wp-surface-2)",
                  }}
                >
                  {s.category}
                </span>
              </div>
              {!compact && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--wp-text-faint)" }}>
                  {s.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
