import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useId,
  useCallback,
} from "react";
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
const TOKEN_PLACEHOLDER = "Search…  (press / to focus)";

/* Sort cycles through 4 states: name↑ name↓ id↑ id↓ */
type SortState = { type: "name" | "id"; order: "asc" | "desc" };
const SORT_CYCLE: SortState[] = [
  { type: "name", order: "asc" },
  { type: "name", order: "desc" },
  { type: "id", order: "asc" },
  { type: "id", order: "desc" },
];
function nextSort(current: SortState): SortState {
  const idx = SORT_CYCLE.findIndex((s) => s.type === current.type && s.order === current.order);
  return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
}
function sortLabel(s: SortState) {
  return `${s.type === "name" ? "Name" : "ID"} ${s.order === "asc" ? "↑" : "↓"}`;
}

const MEDIA_TYPES = ["all", "image", "video", "web", "gif"] as const;
const MEDIA_LABELS: Record<(typeof MEDIA_TYPES)[number], string> = {
  all: "All",
  image: "Images",
  video: "Videos",
  web: "Web",
  gif: "GIF",
};

function isKeyboardTargetInsideEditableField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest("[contenteditable='true']") != null;
}

function galleryFilterInputHasFocus(reactSelectInputId: string): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement && a.id === reactSelectInputId;
}

const FilterInputNameContext = createContext("");

function GalleryFilterInput(props: InputProps<TokenOption, true>) {
  const filterInputName = useContext(FilterInputNameContext);
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

function Filters() {
  const reactSelectId = useId();
  const filterInputName = `gallery-filter-${reactSelectId}`;
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
  const prevTokensRef = useRef<string[]>(partialFilters.filterTokens);
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

  const [prevStoreOrder, setPrevStoreOrder] = useState(filters.order);
  const [prevStoreType, setPrevStoreType] = useState(filters.type);
  const [prevStoreMediaType, setPrevStoreMediaType] = useState(filters.mediaType);

  if (
    filters.order !== prevStoreOrder ||
    filters.type !== prevStoreType ||
    filters.mediaType !== prevStoreMediaType
  ) {
    setPrevStoreOrder(filters.order);
    setPrevStoreType(filters.type);
    setPrevStoreMediaType(filters.mediaType);
    setPartialFilters((prev) => ({
      ...prev,
      order: filters.order,
      type: filters.type,
      mediaType: filters.mediaType,
    }));
  }

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

  const clearAll = useCallback(() => {
    setFilterInput("");
    selectRef.current?.blur();
    setPartialFilters((prev) => {
      const next: PartialFilters = { ...prev, filterTokens: [] };
      prevTokensRef.current = next.filterTokens;
      return next;
    });
    clearGalleryFilterInputHistory();
    setInputHistoryTick((n) => n + 1);
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
  const hasActiveSearch = partialFilters.filterTokens.length > 0 || inputHistoryCount > 0;
  const currentSort: SortState = { type: partialFilters.type, order: partialFilters.order };

  const handleSortCycle = () => {
    const next = nextSort(currentSort);
    setPartialFilters((p) => ({ ...p, type: next.type, order: next.order }));
  };

  /* react-select classNames — same logic as before */
  const filterSelectClassNames = useMemo(
    () =>
      isNeo
        ? {
            control: ({ isFocused }: { isFocused: boolean }) =>
              [
                "neo-rs-control flex min-h-10 flex-wrap items-center gap-1 px-2 py-1",
                isFocused ? "neo-rs-control--focused" : "",
              ].join(" "),
            valueContainer: () => "flex flex-1 flex-wrap gap-1 py-0.5",
            multiValue: () => "badge badge-primary gap-1 max-w-full",
            multiValueLabel: () => "text-xs font-extrabold uppercase tracking-tight truncate",
            multiValueRemove: () =>
              "hover:bg-primary-focus rounded-none px-0.5 text-lg font-black leading-none opacity-80 hover:opacity-100",
            input: () => "min-w-[8ch] flex-1 bg-transparent text-sm font-bold outline-none",
            placeholder: () =>
              "truncate text-xs font-extrabold uppercase tracking-widest text-base-content/40",
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
                "flex min-h-10 flex-wrap items-center gap-1 bg-transparent px-2 py-1",
                isFocused ? "" : "",
              ].join(" "),
            valueContainer: () => "flex flex-1 flex-wrap gap-1 py-0.5",
            multiValue: () => "badge badge-primary gap-1 max-w-full",
            multiValueLabel: () => "text-xs font-medium truncate",
            multiValueRemove: () =>
              "hover:bg-primary-focus rounded px-0.5 text-base leading-none opacity-70 hover:opacity-100",
            input: () => "min-w-[8ch] flex-1 bg-transparent text-sm outline-none",
            placeholder: () => "text-base-content/40 truncate text-sm",
            menu: () => "mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-xl",
            menuList: () => "max-h-[min(70vh,24rem)] overflow-y-auto py-1",
            option: ({ isFocused }: { isFocused: boolean }) =>
              `cursor-pointer px-3 py-2 text-sm ${isFocused ? "bg-base-200" : ""}`,
          },
    [isNeo],
  );

  /* ── Shared button base ─────────────────────────────────────── */
  const pillBase = isNeo
    ? "btn btn-sm rounded-none uppercase font-black tracking-tight text-xs"
    : "btn btn-sm rounded-lg text-xs font-medium";

  const pillActive = isNeo ? "btn-primary" : "btn-primary";
  const pillIdle = isNeo ? "btn-active" : "btn-ghost text-base-content/70 hover:text-base-content";

  return (
    <section
      className={`flex flex-wrap items-center gap-1 px-4 pt-3 pb-2${isNeo ? " neo-filters-strip" : ""}`}
      data-prevent-gallery-marquee
    >
      {/* ── Media type pills ──────────────────────────────────── */}
      {MEDIA_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={`${pillBase} ${partialFilters.mediaType === type ? pillActive : pillIdle}`}
          onClick={() => setPartialFilters((p) => ({ ...p, mediaType: type }))}
        >
          {MEDIA_LABELS[type]}
        </button>
      ))}

      {/* Sort — single cycling button */}
      <button
        type="button"
        className={`${pillBase} ${pillIdle}`}
        onClick={handleSortCycle}
        title="Cycle sort: Name↑ → Name↓ → ID↑ → ID↓"
      >
        {sortLabel(currentSort)}
      </button>

      {/* Advanced filters */}
      <button
        type="button"
        className={`${pillBase} ${pillIdle}`}
        onClick={() => useModalStore.getState().open("AdvancedFiltersModal")}
      >
        Filters
      </button>

      {/* ── Search bar — sits right of pills at ≥md, wraps to its own line at <md ── */}
      <div
        className={`relative flex items-center gap-0 w-full md:w-auto md:flex-1 md:max-w-lg ml-auto mt-1 md:mt-0 ${
          isNeo
            ? "neo-rs-control-wrapper"
            : "rounded-xl bg-base-200 border border-base-content/10 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 focus-within:ring-offset-base-100"
        }`}
      >
        {/* Search icon */}
        <svg
          className="ml-3 h-4 w-4 shrink-0 text-base-content/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>

        {/* react-select input */}
        <div className="min-w-0 flex-1">
          <FilterInputNameContext.Provider value={filterInputName}>
            <CreatableSelect<TokenOption, true>
              key={`gf-select-${inputHistoryTick}`}
              ref={selectRef}
              inputId={reactSelectId}
              instanceId={reactSelectId}
              isMulti
              unstyled
              components={{ Input: GalleryFilterInput }}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
              menuPosition="fixed"
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 10000 }) }}
              classNames={filterSelectClassNames}
              formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
              isValidNewOption={(inputValue) => inputValue.trim().length > 0}
              placeholder={TOKEN_PLACEHOLDER}
              options={selectOptions}
              value={tokenValue}
              onInputChange={(v) => setFilterInput(v)}
              onChange={(opts) => onTokensChange(opts as MultiValue<TokenOption>)}
              closeMenuOnSelect={false}
              filterOption={null}
              noOptionsMessage={() => null}
            />
          </FilterInputNameContext.Provider>
        </div>

        {/* Trailing actions: clear + help */}
        <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
          {hasActiveSearch && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear search and history"
              className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/40 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100"
              title="Clear search tokens and history"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => useModalStore.getState().open("GalleryFilterCheatsheetModal")}
            aria-label="Filter syntax help"
            className="flex items-center justify-center w-7 h-7 rounded-md text-base-content/30 hover:text-base-content/70 hover:bg-base-content/8 transition-colors duration-100"
            title="Filter syntax help"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default Filters;
