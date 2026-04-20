import { useEffect, useState, useRef, useMemo, useId, useCallback } from "react";
import CreatableSelect from "react-select/creatable";
import type { MultiValue, SelectInstance } from "react-select";
import { components as builtinSelectComponents } from "react-select";
import type { InputProps } from "react-select";
import useDebounce from "../hooks/useDebounce";
import type { Filters as FiltersType } from "../types/rendererTypes";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useIsNeo } from "../hooks/useIsNeo";
import { useModalStore } from "../stores/modalStore";
import { mapFiltersToImageQueryParams } from "../utils/galleryFilterTokens";
import {
  clearGalleryFilterInputHistory,
  loadGalleryFilterInputHistory,
  recordGalleryFilterInputHistoryEntry,
} from "../utils/galleryFilterInputHistory";

interface PartialFilters {
  order: "asc" | "desc";
  type: "name" | "id";
  mediaType: "all" | "image" | "video" | "web" | "gif";
  filterTokens: string[];
}

function partialFromStore(f: FiltersType): PartialFilters {
  return {
    order: f.order,
    type: f.type,
    mediaType: f.mediaType,
    filterTokens: [...f.filterTokens],
  };
}

type TokenOption = { label: string; value: string };

const TOKEN_PLACEHOLDER = "search";

function isKeyboardTargetInsideEditableField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest("[contenteditable='true']") != null;
}

function galleryFilterInputHasFocus(reactSelectInputId: string): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement && a.id === reactSelectInputId;
}

function Filters() {
  const reactSelectId = useId();
  const filterInputName = useMemo(
    () =>
      `gallery-filter-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    [],
  );
  const { setFilters, filters } = useImagesStore(
    useShallow((s) => ({
      setFilters: s.setFilters,
      filters: s.filters,
    })),
  );
  const [partialFilters, setPartialFilters] = useState<PartialFilters>(() =>
    partialFromStore(useImagesStore.getState().filters),
  );
  const partialFiltersRef = useRef(partialFilters);
  const prevTokensRef = useRef<string[]>(
    partialFromStore(useImagesStore.getState().filters).filterTokens,
  );
  const [inputHistoryTick, setInputHistoryTick] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const selectRef = useRef<SelectInstance<TokenOption, true>>(null);

  useEffect(() => {
    partialFiltersRef.current = partialFilters;
  });

  const inputHistoryCount = useMemo(() => {
    void inputHistoryTick;
    return loadGalleryFilterInputHistory().length;
  }, [inputHistoryTick]);

  const BoundGalleryFilterInput = useMemo(() => {
    function Inner(props: InputProps<TokenOption, true>) {
      return (
        <builtinSelectComponents.Input
          {...props}
          name={filterInputName}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
        />
      );
    }
    return Inner;
  }, [filterInputName]);

  /** Keep sort / media type aligned with persisted store (e.g. after reload or external setFilters). */
  useEffect(() => {
    setPartialFilters((prev) => {
      if (
        prev.order === filters.order &&
        prev.type === filters.type &&
        prev.mediaType === filters.mediaType
      ) {
        return prev;
      }
      return {
        ...prev,
        order: filters.order,
        type: filters.type,
        mediaType: filters.mediaType,
      };
    });
  }, [filters.order, filters.type, filters.mediaType]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;
      if (document.querySelector("dialog[open]")) return;
      if (isKeyboardTargetInsideEditableField(e.target)) return;
      if (galleryFilterInputHasFocus(reactSelectId)) return;
      e.preventDefault();
      selectRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reactSelectId]);

  const selectOptions = useMemo(() => {
    void inputHistoryTick;
    const selected = new Set(partialFilters.filterTokens);
    const seen = new Set<string>();
    const out: TokenOption[] = [];
    const q = filterInput.trim().toLowerCase();
    for (const raw of loadGalleryFilterInputHistory()) {
      const v = raw.trim();
      if (!v || selected.has(v) || seen.has(v)) continue;
      if (q && !v.toLowerCase().includes(q)) continue;
      seen.add(v);
      out.push({ label: v, value: v });
    }

    return out;
  }, [partialFilters.filterTokens, inputHistoryTick, filterInput]);

  const tokenValue: MultiValue<TokenOption> = useMemo(
    () => partialFilters.filterTokens.map((t) => ({ label: t, value: t })),
    [partialFilters.filterTokens],
  );

  const onTokensChange = (opts: MultiValue<TokenOption>) => {
    const next = (opts ?? []).map((o) => o.value);
    const prev = prevTokensRef.current;
    for (const t of next) {
      if (!prev.includes(t)) recordGalleryFilterInputHistoryEntry(t);
    }
    prevTokensRef.current = next;
    setPartialFilters((p) => ({ ...p, filterTokens: next }));
  };

  const clearSearchTokens = useCallback(() => {
    setFilterInput("");
    selectRef.current?.blur();
    setPartialFilters((prev) => {
      const next: PartialFilters = { ...prev, filterTokens: [] };
      prevTokensRef.current = next.filterTokens;
      return next;
    });
  }, []);

  const clearInputHistory = useCallback(() => {
    clearGalleryFilterInputHistory();
    setInputHistoryTick((n) => n + 1);
    setFilterInput("");
    selectRef.current?.blur();
  }, []);

  useDebounce(
    () => {
      const newFilters: FiltersType = {
        ...partialFilters,
        advancedFilters: filters.advancedFilters,
      };
      setFilters(newFilters);
      useImagesStore.getState().fetchPage(1, mapFiltersToImageQueryParams(partialFilters));
    },
    200,
    [partialFilters],
  );

  useEffect(() => {
    const resetFilters: FiltersType = {
      ...partialFiltersRef.current,
      advancedFilters: filters.advancedFilters,
    };
    setFilters(resetFilters);
    useImagesStore.getState().fetchPage(1, mapFiltersToImageQueryParams(partialFiltersRef.current));
  }, [filters.advancedFilters, setFilters]);

  const isNeo = useIsNeo();

  const filterSelectClassNames = useMemo(
    () =>
      isNeo
        ? {
            control: ({ isFocused }: { isFocused: boolean }) =>
              [
                "neo-rs-control flex min-h-12 flex-wrap items-center gap-1 px-2 py-1 text-center text-base",
                isFocused ? "neo-rs-control--focused" : "",
              ].join(" "),
            valueContainer: () => "flex flex-1 flex-wrap gap-1 py-0.5",
            multiValue: () => "badge badge-primary gap-1 max-w-full",
            multiValueLabel: () => "text-xs font-extrabold uppercase tracking-tight truncate",
            multiValueRemove: () =>
              "hover:bg-primary-focus rounded-none px-0.5 text-lg font-black leading-none opacity-80 hover:opacity-100",
            input: () => "min-w-[8ch] flex-1 bg-transparent text-base font-bold outline-none",
            placeholder: () =>
              "truncate text-xs font-extrabold uppercase tracking-widest text-base-content/55",
            menu: () => "neo-rs-menu mt-1 w-full p-0 shadow-none",
            menuList: () => "neo-rs-menuList max-h-[min(70vh,24rem)] overflow-y-auto py-1",
            option: ({ isFocused }: { isFocused: boolean }) =>
              [
                "neo-rs-option cursor-pointer px-3 py-2 text-xs font-extrabold uppercase tracking-tight",
                isFocused ? "neo-rs-option--focused" : "",
              ].join(" "),
          }
        : {
            control: ({ isFocused }: { isFocused: boolean }) =>
              [
                "flex min-h-12 flex-wrap items-center gap-1 rounded-xl border-0 bg-base-300 px-2 py-1 text-center text-base font-medium",
                isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100" : "",
              ].join(" "),
            valueContainer: () => "flex flex-1 flex-wrap gap-1 py-0.5",
            multiValue: () => "badge badge-primary gap-1 max-w-full",
            multiValueLabel: () => "text-xs font-medium truncate",
            multiValueRemove: () =>
              "hover:bg-primary-focus rounded px-0.5 text-lg leading-none opacity-70 hover:opacity-100",
            input: () => "min-w-[8ch] flex-1 bg-transparent text-base outline-none",
            placeholder: () => "text-base-content/50 truncate",
            menu: () => "mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-xl",
            menuList: () => "max-h-[min(70vh,24rem)] overflow-y-auto py-1",
            option: ({ isFocused }: { isFocused: boolean }) =>
              `cursor-pointer px-3 py-2 text-sm ${isFocused ? "bg-base-200" : ""}`,
          },
    [isNeo],
  );

  return (
    <section
      className={`group mt-4 lg:mt-10 mb-3 lg:mb-5 flex flex-wrap justify-center gap-2 px-2${isNeo ? " neo-filters-strip" : ""}`}
    >
      <div className="tooltip" data-tip="more filters">
        <button
          type="button"
          className="btn btn-active rounded-xl uppercase"
          onClick={() => {
            useModalStore.getState().open("AdvancedFiltersModal");
          }}
        >
          Filters
        </button>
      </div>
      <div className="tooltip" data-tip="Order by Name or ID">
        <label className="btn swap btn-active swap-rotate rounded-xl text-xs uppercase">
          <input
            type="checkbox"
            aria-label="Sort by name or ID"
            checked={partialFilters.type === "name"}
            onChange={() => {
              setPartialFilters((previous) => {
                const newType = previous.type === "name" ? "id" : "name";
                return { ...previous, type: newType };
              });
            }}
          />
          <div className="swap-on">Name</div>
          <div className="swap-off">ID</div>
        </label>
      </div>
      <div className="tooltip" data-tip="Ascending or Descending">
        <label className="btn swap btn-active swap-rotate rounded-xl uppercase">
          <input
            type="checkbox"
            aria-label="Ascending or descending sort"
            checked={partialFilters.order === "asc"}
            onChange={() => {
              setPartialFilters((previous) => {
                const newOrder = previous.order === "asc" ? "desc" : "asc";
                return { ...previous, order: newOrder };
              });
            }}
          />
          <div className="swap-on">Asc</div>
          <div className="swap-off">Desc</div>
        </label>
      </div>
      <div className="tooltip shrink-0 self-center" data-tip="Filter syntax (tokens, color, near)">
          <button
            type="button"
            className="btn btn-active rounded-xl uppercase min-h-10 min-w-16 text-lg font-semibold"
            aria-label="Filter syntax help"
            onClick={() => useModalStore.getState().open("GalleryFilterCheatsheetModal")}
          >
            ?
          </button>
        </div>
      <div className="join">
        {(["all", "image", "video", "web", "gif"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`join-item btn btn-md ${partialFilters.mediaType === type ? "btn-primary" : "btn-active"}`}
            onClick={() => {
              setPartialFilters((previous) => ({ ...previous, mediaType: type }));
            }}
          >
            {type === "all"
              ? "All"
              : type === "web"
                ? "Web"
                : type === "gif"
                  ? "GIF"
                  : `${type[0].toUpperCase()}${type.slice(1)}s`}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex w-full min-w-[min(100%,18rem)] max-w-3xl flex-1 items-stretch gap-1">
        <div className="min-w-0 flex-1">
          <CreatableSelect<TokenOption, true>
            key={`gf-select-${inputHistoryTick}`}
            ref={selectRef}
            inputId={reactSelectId}
            instanceId={reactSelectId}
            isMulti
            unstyled
            components={{ Input: BoundGalleryFilterInput }}
            menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            menuPosition="fixed"
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 10000 }),
            }}
            classNames={filterSelectClassNames}
            formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
            isValidNewOption={(inputValue) => inputValue.trim().length > 0}
            placeholder={TOKEN_PLACEHOLDER}
            options={selectOptions}
            value={tokenValue}
            onInputChange={(v) => {
              // Sync on every rs notification (`input-change`, `set-value` after chip, `menu-close`, `input-blur`).
              // Only updating on `input-change` left `filterInput` stale so history options disappeared after select.
              setFilterInput(v);
            }}
            onChange={(opts) => {
              onTokensChange(opts as MultiValue<TokenOption>);
            }}
            closeMenuOnSelect={false}
            /** Options are fully derived in `selectOptions` (history + creatable). Default rs filter would hide most rows (e.g. only one past `q:…` matching the whole input). */
            filterOption={null}
            noOptionsMessage={() => null}
          />
        </div>
        {(partialFilters.filterTokens.length > 0 || inputHistoryCount > 0) && (
          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 self-stretch sm:flex-row sm:items-center sm:gap-1">
            {inputHistoryCount > 0 && (
              <div className="tooltip tooltip-left" data-tip="Clear recent search history (saved suggestions)">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm h-10 min-h-10 px-2 text-base-content/70 hover:text-base-content"
                  aria-label="Clear recent searches"
                  onClick={clearInputHistory}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4l16 16"
                    />
                  </svg>
                </button>
              </div>
            )}
            {partialFilters.filterTokens.length > 0 && (
              <div className="tooltip tooltip-left" data-tip="Remove all active filter chips">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm h-10 min-h-10 px-2 text-base-content/70 hover:text-base-content"
                  aria-label="Clear search tokens"
                  onClick={clearSearchTokens}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default Filters;
