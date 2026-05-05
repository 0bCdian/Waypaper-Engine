/**
 * Inline Theme Selector for Settings — search + tone filters, pill chips (no nested theme previews).
 */

import type React from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsNeo } from "@/hooks/useIsNeo";
import { cn } from "@/utils/cn";

type ToneFilterId = "all" | "light" | "dark";

export interface ThemePickerEntry {
  name: string;
  displayName: string;
  category: string;
}

/**
 * Exported for tests — applies tone bucket + query against the flattened theme list.
 */
export function filterThemesForPicker(
  themes: readonly ThemePickerEntry[],
  tone: ToneFilterId,
  query: string,
): ThemePickerEntry[] {
  const q = query.trim().toLowerCase();
  const normalized = q.replace(/\s+/g, " ");

  return themes.filter((t) => {
    if (!toneMatchesFilter(t.category, tone)) return false;

    if (!normalized) return true;

    const haystack = `${t.name} ${t.displayName}`.toLowerCase();
    if (haystack.includes(normalized)) return true;

    return normalized.split(/\s+/).every((tok) => tok.length > 0 && haystack.includes(tok));
  });
}

function toneMatchesFilter(category: string, tone: ToneFilterId): boolean {
  if (tone === "all") return true;
  if (category === "mixed") return true;
  if (tone === "light") return category === "light";
  return category === "dark";
}

interface InlineThemeSelectorProps {
  className?: string;
  onThemeChange?: (themeName: string) => void;
}

const PILLS_SCROLL_CLASS =
  "max-h-[min(50vh,24rem)] overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]";

const TONE_OPTIONS: { id: ToneFilterId; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Every theme" },
  { id: "light", label: "Light", hint: "Light & mixed-tone themes" },
  { id: "dark", label: "Dark", hint: "Dark & mixed-tone themes" },
];

export const InlineThemeSelector: React.FC<InlineThemeSelectorProps> = ({
  className = "",
  onThemeChange,
}) => {
  const idBase = useId();
  const searchId = `${idBase}-search`;
  const toneGroupLabelId = `${idBase}-tone-label`;

  const { currentTheme, setTheme, getAvailableThemes } = useTheme();
  const availableThemes = useMemo(() => getAvailableThemes(), [getAvailableThemes]);
  const isNeo = useIsNeo();

  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<ToneFilterId>("all");

  const filteredThemes = useMemo(
    () => filterThemesForPicker(availableThemes, tone, query),
    [availableThemes, tone, query],
  );

  const handleThemeSelect = useCallback(
    (themeName: string) => {
      setTheme(themeName);
      onThemeChange?.(themeName);
    },
    [onThemeChange, setTheme],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <label
          htmlFor={searchId}
          className={cn(
            "input input-sm input-bordered relative flex flex-1 min-w-0 items-center gap-2 sm:min-w-[min(100%,16rem)] sm:max-w-md",
            isNeo &&
              "rounded-none border-4 border-base-content bg-base-100 shadow-[3px_3px_0_0_var(--color-base-content)]",
          )}
        >
          <svg
            className="h-4 w-4 shrink-0 text-base-content/45"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.2-4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            id={searchId}
            type="search"
            placeholder="Filter themes…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="grow font-[family-name:var(--font-body)] placeholder:text-base-content/35"
          />
        </label>

        <fieldset
          className="min-w-fit shrink-0 space-y-1"
          role="radiogroup"
          aria-labelledby={toneGroupLabelId}
        >
          <span id={toneGroupLabelId} className="sr-only">
            Filter themes by appearance
          </span>
          <div
            className={cn(
              "grid w-full min-w-[12rem] grid-cols-3 gap-0 overflow-hidden rounded-lg bg-base-200/70 p-0.5 sm:w-auto sm:min-w-fit",
              isNeo &&
                "rounded-none border-2 border-base-content bg-base-300/80 shadow-[4px_4px_0_0_var(--color-base-content)]",
            )}
          >
            {TONE_OPTIONS.map((opt) => {
              const active = tone === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={opt.label}
                  title={opt.hint}
                  className={cn(
                    "btn btn-xs btn-ghost h-auto min-h-8 flex-1 gap-1 border-0 px-2 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wide sm:btn-sm sm:min-h-9 sm:px-3 sm:text-[11px]",
                    active
                      ? "bg-base-100 text-base-content shadow-sm"
                      : "text-base-content/55 hover:bg-base-300/70 hover:text-base-content",
                    isNeo && active && "rounded-none shadow-inner",
                  )}
                  onClick={() => setTone(opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2",
          isNeo && "rounded-none border-2 border-base-content bg-base-100",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
          Active
        </span>
        <span
          className={cn(
            "badge badge-primary badge-sm capitalize font-[family-name:var(--font-display)] font-semibold",
            isNeo && "rounded-none border border-base-content",
          )}
        >
          {currentTheme}
        </span>
      </div>

      {filteredThemes.length === 0 ? (
        <div
          className={cn(
            "rounded-box border border-dashed border-base-content/15 bg-base-200/35 px-4 py-10 text-center",
            isNeo &&
              "rounded-none border-4 border-base-content bg-base-200/55 shadow-[4px_4px_0_0_var(--color-base-content)]",
          )}
          role="status"
        >
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-base-content">
            No themes match
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs text-base-content/65">
            Clear the search or set brightness to &ldquo;All&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "flex flex-wrap gap-2 border-t border-base-content/10 pt-3",
              PILLS_SCROLL_CLASS,
            )}
          >
            {filteredThemes.map((theme) => {
              const selected = theme.name === currentTheme;
              return (
                <button
                  key={theme.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleThemeSelect(theme.name)}
                  className={cn(
                    "btn btn-sm shrink-0 font-[family-name:var(--font-display)] capitalize",
                    selected
                      ? "btn-primary"
                      : "btn-outline border-base-content/25 text-base-content hover:border-base-content/40",
                    isNeo &&
                      cn(
                        "rounded-none border-2 font-bold",
                        selected
                          ? "border-primary"
                          : "border-base-content shadow-[3px_3px_0_0_var(--color-base-content)]",
                      ),
                  )}
                >
                  {theme.displayName}
                </button>
              );
            })}
          </div>
          <p className="border-t border-base-content/10 pt-2 text-[10px] leading-snug text-base-content/45">
            <span className="tabular-nums">{filteredThemes.length}</span> themes shown
          </p>
        </>
      )}
    </div>
  );
};

export default InlineThemeSelector;
