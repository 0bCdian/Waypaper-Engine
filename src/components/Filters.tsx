import {
  createContext,
  use,
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
import { cn } from "../utils/cn";
import type { Filters as FiltersType } from "../types/rendererTypes";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
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

/** Slider bounds for palette similarity (CIE76 ΔE); daemon still accepts any ≥ 0 on the wire. */
const PALETTE_SIMILAR_DELTA_MIN = 4;
const PALETTE_SIMILAR_DELTA_MAX = 50;

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
  const filterInputName = use(FilterInputNameContext);
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
  const paletteDeltaSliderId = `${reactSelectId}-palette-delta`;
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

  const prevStoreOrderRef = useRef(filters.order);
  const prevStoreTypeRef = useRef(filters.type);
  const prevStoreMediaTypeRef = useRef(filters.mediaType);

  if (
    filters.order !== prevStoreOrderRef.current ||
    filters.type !== prevStoreTypeRef.current ||
    filters.mediaType !== prevStoreMediaTypeRef.current
  ) {
    prevStoreOrderRef.current = filters.order;
    prevStoreTypeRef.current = filters.type;
    prevStoreMediaTypeRef.current = filters.mediaType;
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
      // oxlint-disable-next-line react-doctor/js-set-map-lookups -- string.includes for substring match; not array membership
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
    const prevSet = new Set(prevTokensRef.current);
    for (const t of next) {
      if (!prevSet.has(t)) recordGalleryFilterInputHistoryEntry(t);
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
    const base = useImagesStore.getState().filters;
    useImagesStore.getState().setFilters({
      ...base,
      filterTokens: [],
      paletteSimilarToId: null,
    });
    clearGalleryFilterInputHistory();
    setInputHistoryTick((n) => n + 1);
    useImagesStore.getState().fetchPage(1);
  }, []);

  useDebounce(
    () => {
      const base = useImagesStore.getState().filters;
      const newFilters: FiltersType = {
        ...base,
        order: partialFilters.order,
        type: partialFilters.type,
        mediaType: partialFilters.mediaType,
        filterTokens: partialFilters.filterTokens,
      };
      setFilters(newFilters);
      useImagesStore.getState().fetchPage(1, mapFiltersToImageQueryParams(newFilters));
    },
    200,
    [partialFilters],
  );

  useEffect(() => {
    const base = useImagesStore.getState().filters;
    const resetFilters: FiltersType = {
      ...base,
      order: partialFiltersRef.current.order,
      type: partialFiltersRef.current.type,
      mediaType: partialFiltersRef.current.mediaType,
      filterTokens: partialFiltersRef.current.filterTokens,
      advancedFilters: filters.advancedFilters,
    };
    setFilters(resetFilters);
    useImagesStore.getState().fetchPage(1, mapFiltersToImageQueryParams(resetFilters));
  }, [filters.advancedFilters, setFilters]);

  const { paletteRefId, paletteRefLabel, paletteMaxDeltaE } = useImagesStore(
    useShallow((s) => {
      const id = s.filters.paletteSimilarToId;
      const img = id != null ? s.imagesMap.get(id) : undefined;
      return {
        paletteRefId: id,
        paletteRefLabel: img?.name ?? (id != null ? `#${id}` : ""),
        paletteMaxDeltaE: s.filters.paletteSimilarMaxDeltaE,
      };
    }),
  );

  const clearPaletteSimilar = useCallback(() => {
    const base = useImagesStore.getState().filters;
    useImagesStore.getState().setFilters({
      ...base,
      paletteSimilarToId: null,
    });
    useImagesStore.getState().fetchPage(1);
  }, []);

  const [paletteDeltaDraft, setPaletteDeltaDraft] = useState(paletteMaxDeltaE);

  useEffect(() => {
    if (paletteRefId == null) return;
    const clamped = Math.min(
      PALETTE_SIMILAR_DELTA_MAX,
      Math.max(PALETTE_SIMILAR_DELTA_MIN, Math.round(paletteMaxDeltaE)),
    );
    setPaletteDeltaDraft(clamped);
    if (clamped !== paletteMaxDeltaE) {
      const base = useImagesStore.getState().filters;
      useImagesStore.getState().setFilters({
        ...base,
        paletteSimilarMaxDeltaE: clamped,
      });
      useImagesStore.getState().fetchPage(1);
    }
  }, [paletteRefId, paletteMaxDeltaE]);

  const commitPaletteDeltaE = useCallback((raw: number) => {
    const clamped = Math.min(
      PALETTE_SIMILAR_DELTA_MAX,
      Math.max(PALETTE_SIMILAR_DELTA_MIN, Math.round(raw)),
    );
    setPaletteDeltaDraft(clamped);
    const base = useImagesStore.getState().filters;
    if (base.paletteSimilarMaxDeltaE === clamped) return;
    useImagesStore.getState().setFilters({
      ...base,
      paletteSimilarMaxDeltaE: clamped,
    });
    useImagesStore.getState().fetchPage(1);
  }, []);

  const hasPaletteSimilar = paletteRefId != null;
  const hasActiveSearch =
    partialFilters.filterTokens.length > 0 || inputHistoryCount > 0 || hasPaletteSimilar;
  const currentSort: SortState = {
    type: partialFilters.type,
    order: partialFilters.order,
  };

  const handleSortCycle = () => {
    const next = nextSort(currentSort);
    setPartialFilters((p) => ({ ...p, type: next.type, order: next.order }));
  };

  /* react-select classNames — neo-rs-* classes are scoped to [data-design="neobrutalist"], no-ops in modern */
  const filterSelectClassNames = useMemo(
    () => ({
      control: ({ isFocused }: { isFocused: boolean }) =>
        [
          "neo-rs-control flex min-h-10 flex-wrap items-center gap-1 bg-transparent px-2 py-1",
          isFocused ? "neo-rs-control--focused" : "",
        ].join(" "),
      valueContainer: () => "flex flex-1 flex-wrap gap-1 py-0.5",
      multiValue: () => "badge badge-primary gap-1 max-w-full",
      multiValueLabel: () => "text-xs font-medium truncate",
      multiValueRemove: () =>
        "hover:bg-primary-focus rounded-[var(--wp-radius-sm)] px-0.5 text-base leading-none opacity-70 hover:opacity-100",
      input: () => "min-w-[8ch] flex-1 bg-transparent text-sm outline-none",
      placeholder: () => "text-base-content/40 truncate text-sm",
      menu: () =>
        "neo-rs-menu mt-1 w-full rounded-[var(--wp-radius-md)] border border-base-300 bg-base-100 shadow-xl p-0",
      menuList: () => "neo-rs-menuList max-h-[min(70vh,24rem)] overflow-y-auto py-1",
      option: ({ isFocused }: { isFocused: boolean }) =>
        [
          "neo-rs-option cursor-pointer px-3 py-2 text-sm",
          isFocused ? "neo-rs-option--focused bg-base-200" : "",
        ].join(" "),
    }),
    [],
  );

  /* ── Shared button base ─────────────────────────────────────── */
  const pillBase = "btn btn-sm text-xs rounded-[var(--wp-radius-md)]";
  const pillActive = "btn-primary";
  const pillIdle = "btn-ghost text-base-content/70 hover:text-base-content";

  return (
    <section data-prevent-gallery-marquee="true" className="px-4 pt-3 pb-2 neo-filters-strip">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col items-center justify-center gap-3 md:flex-row md:flex-wrap md:gap-x-4">
        {/* Media / sort / advanced — grouped and centered with search */}
        <div className="flex w-full flex-wrap items-center justify-center gap-1 md:w-auto md:shrink-0">
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

          <button
            type="button"
            className={`${pillBase} ${pillIdle}`}
            onClick={handleSortCycle}
            title="Cycle sort: Name↑ → Name↓ → ID↑ → ID↓"
          >
            {sortLabel(currentSort)}
          </button>

          <button
            type="button"
            className={`${pillBase} ${pillIdle}`}
            onClick={() => useModalStore.getState().open("AdvancedFiltersModal")}
          >
            Filters
          </button>
        </div>

        <div className="w-full min-w-0 md:max-w-4xl md:flex-1">
          {/* neo-rs-control-wrapper scoped to [data-design="neobrutalist"]; modern classes are the base */}
          <div className="neo-rs-control-wrapper relative flex w-full items-center gap-0 overflow-visible rounded-[var(--wp-radius-lg)] bg-base-200 border border-base-content/10 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 focus-within:ring-offset-base-100">
            {/* Search icon */}
            <svg
              className="ml-3 size-4 shrink-0 neo-search-inline-icon text-base-content/40"
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
                  components={{
                    Input: GalleryFilterInput,
                    DropdownIndicator: () => null,
                    IndicatorSeparator: () => null,
                    IndicatorsContainer: () => null,
                  }}
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
                  onInputChange={(v) => setFilterInput(v)}
                  onChange={(opts) => onTokensChange(opts as MultiValue<TokenOption>)}
                  closeMenuOnSelect={false}
                  filterOption={null}
                  noOptionsMessage={() => null}
                />
              </FilterInputNameContext.Provider>
            </div>

            {hasPaletteSimilar && (
              <p id={`${paletteDeltaSliderId}-hint`} className="sr-only">
                Adjust how strictly wallpapers must match the reference palette. Lower delta E is
                tighter; higher is looser.
              </p>
            )}

            {/* Desktop / tablet: single-row palette strip — same bar height, no layout shift */}
            {hasPaletteSimilar && (
              <div
                className={cn(
                  "animate-fade-in hidden min-h-0 shrink-0 items-center justify-center border-base-content/20 py-0 md:flex md:self-stretch",
                  "border-l-[length:var(--wp-border-w)] border-current/40 pl-2 pr-1",
                )}
                title={`Similar palette: ${paletteRefLabel}. Lower ΔE is stricter; higher includes more images.`}
              >
                <div className="flex min-h-0 flex-1 items-center gap-1.5 lg:gap-2">
                  <span
                    className="max-w-[4.25rem] truncate leading-none lg:max-w-[6rem] text-[11px] font-medium text-base-content/90"
                    title={paletteRefLabel}
                  >
                    {paletteRefLabel}
                  </span>
                  <input
                    id={paletteDeltaSliderId}
                    type="range"
                    min={PALETTE_SIMILAR_DELTA_MIN}
                    max={PALETTE_SIMILAR_DELTA_MAX}
                    step={1}
                    value={paletteDeltaDraft}
                    aria-valuemin={PALETTE_SIMILAR_DELTA_MIN}
                    aria-valuemax={PALETTE_SIMILAR_DELTA_MAX}
                    aria-valuenow={paletteDeltaDraft}
                    aria-describedby={`${paletteDeltaSliderId}-hint`}
                    aria-label="Palette similarity closeness"
                    className="range range-primary range-sm mx-0 h-4 min-w-[3.5rem] flex-1 lg:min-w-[5rem]"
                    onChange={(e) => setPaletteDeltaDraft(Number(e.target.value))}
                    onPointerUp={(e) =>
                      commitPaletteDeltaE(Number((e.currentTarget as HTMLInputElement).value))
                    }
                    onKeyUp={(e) => {
                      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                      commitPaletteDeltaE(Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                  <span
                    className="w-6 shrink-0 text-center tabular-nums leading-none lg:w-7 text-[10px] font-semibold opacity-90"
                    title={`ΔE ≤ ${paletteDeltaDraft}`}
                  >
                    {paletteDeltaDraft}
                  </span>
                  <button
                    type="button"
                    className={cn(
                      "btn btn-ghost btn-xs shrink-0 border-0 px-0 font-bold leading-none",
                      "min-h-8 min-w-8 rounded-[var(--wp-radius-sm)] hover:bg-base-content/10",
                    )}
                    aria-label="Clear similar palette filter"
                    onClick={clearPaletteSimilar}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Trailing actions: clear + help */}
            <div className="flex items-center shrink-0 gap-1 pr-2 pl-1">
              {hasActiveSearch && (
                <button
                  type="button"
                  onClick={clearAll}
                  aria-label="Clear search and history"
                  className="neo-search-action flex items-center justify-center size-7 rounded-[var(--wp-radius-sm)] text-base-content/40 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100"
                  title="Clear search tokens and history"
                >
                  <svg
                    className="size-3.5"
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
                className="neo-search-action flex items-center justify-center size-7 rounded-[var(--wp-radius-sm)] text-base-content/30 hover:text-base-content/70 hover:bg-base-content/8 transition-colors duration-100"
                title="Filter syntax help"
              >
                <svg
                  className="size-4"
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

            {/* Mobile: float below bar — no vertical shift of filters strip */}
            {hasPaletteSimilar && (
              <div
                className={cn(
                  "animate-fade-in md:hidden absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[45]",
                  "rounded-[var(--wp-radius-md)] border border-base-content/15 bg-base-100/95 p-2.5 shadow-lg backdrop-blur-sm",
                )}
                role="region"
                aria-label="Similar palette filter"
                title="Lower ΔE is stricter; higher includes more wallpapers."
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="min-w-0 flex-1 truncate font-medium leading-tight text-xs"
                    title={paletteRefLabel}
                  >
                    Similar · {paletteRefLabel}
                  </span>
                  <button
                    type="button"
                    className={cn(
                      "btn btn-ghost btn-xs shrink-0 border-0 px-0 font-bold leading-none",
                      "min-h-8 min-w-8 rounded-[var(--wp-radius-sm)] hover:bg-base-content/10",
                    )}
                    aria-label="Clear similar palette filter"
                    onClick={clearPaletteSimilar}
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 opacity-80">
                    <span className="text-[11px]">Closeness · ΔE ≤ {paletteDeltaDraft}</span>
                  </div>
                  <input
                    id={`${paletteDeltaSliderId}-touch`}
                    type="range"
                    min={PALETTE_SIMILAR_DELTA_MIN}
                    max={PALETTE_SIMILAR_DELTA_MAX}
                    step={1}
                    value={paletteDeltaDraft}
                    aria-valuemin={PALETTE_SIMILAR_DELTA_MIN}
                    aria-valuemax={PALETTE_SIMILAR_DELTA_MAX}
                    aria-valuenow={paletteDeltaDraft}
                    aria-describedby={`${paletteDeltaSliderId}-hint`}
                    aria-label="Palette similarity closeness"
                    className="range range-primary range-sm w-full"
                    onChange={(e) => setPaletteDeltaDraft(Number(e.target.value))}
                    onPointerUp={(e) =>
                      commitPaletteDeltaE(Number((e.currentTarget as HTMLInputElement).value))
                    }
                    onKeyUp={(e) => {
                      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                      commitPaletteDeltaE(Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                  <div className="flex justify-between opacity-55 text-[11px]">
                    <span>Tighter</span>
                    <span>Looser</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Filters;
