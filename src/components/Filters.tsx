import { type ChangeEvent, useEffect, useState, useRef, useMemo, useId } from "react";
import useDebounce from "../hooks/useDebounce";
import type { Filters as FiltersType } from "../types/rendererTypes";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import type { ImageQueryParams } from "../../electron/daemon-go-types";
import { useIsNeo } from "../hooks/useIsNeo";
import { useModalStore } from "../stores/modalStore";

const { goDaemon } = window.API_RENDERER;

interface PartialFilters {
  order: "asc" | "desc";
  type: "name" | "id";
  mediaType: "all" | "image" | "video" | "web" | "gif";
  searchString: string;
  tags: string[];
}
const initialFilters: PartialFilters = {
  order: "desc",
  type: "id",
  mediaType: "all",
  searchString: "",
  tags: [],
};

function parseSearchInput(text: string): { search: string; hashTags: string[] } {
  const hashTags: string[] = [];
  const search = text
    .replace(/#(\S+)/g, (_, tag) => {
      hashTags.push(tag);
      return "";
    })
    .trim();
  return { search, hashTags };
}

function mapFiltersToQueryParams(f: PartialFilters, colors?: string[]): Partial<ImageQueryParams> {
  const { search, hashTags } = parseSearchInput(f.searchString);
  const combinedTags = [...new Set([...f.tags, ...hashTags])];
  return {
    sort_by: f.type === "name" ? "name" : "imported_at",
    sort_order: f.order,
    media_type: f.mediaType === "all" ? undefined : f.mediaType,
    search: search || undefined,
    tags: combinedTags.length > 0 ? combinedTags.join(",") : undefined,
    colors: colors && colors.length > 0 ? colors.join(",") : undefined,
  };
}

function Filters() {
  const searchInputId = useId();
  const { setFilters, filters } = useImagesStore(
    useShallow((s) => ({
      setFilters: s.setFilters,
      filters: s.filters,
    })),
  );
  const [partialFilters, setPartialFilters] = useState(initialFilters);
  const partialFiltersRef = useRef(partialFilters);

  useEffect(() => {
    partialFiltersRef.current = partialFilters;
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tagDropdownOpen) {
      void goDaemon
        .getImageTags()
        .then((resp) => {
          setAllTags(resp.tags ?? []);
        })
        .catch(() => {});
    }
  }, [tagDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTags = useMemo(() => {
    const term = tagSearch.toLowerCase();
    const selected = new Set(partialFilters.tags);
    return allTags.filter((t) => !selected.has(t) && t.toLowerCase().includes(term));
  }, [allTags, partialFilters.tags, tagSearch]);

  const onTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    if (target !== null) {
      const text = target.value;
      setPartialFilters((previous: PartialFilters) => {
        return { ...previous, searchString: text };
      });
    }
  };

  const toggleTag = (tag: string) => {
    setPartialFilters((prev) => {
      const has = prev.tags.includes(tag);
      return {
        ...prev,
        tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  useDebounce(
    () => {
      const newFilters: FiltersType = {
        ...partialFilters,
        advancedFilters: filters.advancedFilters,
      };
      setFilters(newFilters);
      useImagesStore
        .getState()
        .fetchPage(1, mapFiltersToQueryParams(partialFilters, filters.advancedFilters.colors));
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
    useImagesStore
      .getState()
      .fetchPage(
        1,
        mapFiltersToQueryParams(partialFiltersRef.current, filters.advancedFilters.colors),
      );
  }, [filters.advancedFilters, setFilters]);
  const isNeo = useIsNeo();
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
      <div className="join">
        {(["all", "image", "video", "web"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`join-item btn btn-sm ${partialFilters.mediaType === type ? "btn-primary" : "btn-active"}`}
            onClick={() => {
              setPartialFilters((previous) => ({ ...previous, mediaType: type }));
            }}
          >
            {type === "all"
              ? "All"
              : type === "web"
                ? "Web"
                : `${type[0].toUpperCase()}${type.slice(1)}s`}
          </button>
        ))}
      </div>
      <input
        onChange={onTextChange}
        type="text"
        id={searchInputId}
        className="input input-primary w-full sm:w-1/3 lg:w-1/4 rounded-xl border-0 bg-base-300 text-center text-xl font-medium"
        placeholder="Search or #tag"
      />

      {/* Tag filter */}
      <div className="relative" ref={tagRef}>
        <button
          type="button"
          className={`btn btn-active rounded-xl uppercase ${partialFilters.tags.length > 0 ? "btn-primary" : ""}`}
          onClick={() => setTagDropdownOpen((v) => !v)}
        >
          Tags{partialFilters.tags.length > 0 ? ` (${partialFilters.tags.length})` : ""}
        </button>

        {tagDropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-base-300 bg-base-100 p-2 shadow-xl">
            <input
              type="text"
              className="input input-bordered input-xs w-full mb-2"
              placeholder="Search tags..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              ref={(el) => el?.focus()}
            />

            {/* Selected tags */}
            {partialFilters.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {partialFilters.tags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className="badge badge-primary badge-sm cursor-pointer gap-1"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag} &times;
                  </button>
                ))}
              </div>
            )}

            {allTags.length === 0 && partialFilters.tags.length === 0 ? (
              <p className="px-2 py-3 text-xs text-base-content/50 text-center">
                No tags yet — tag images from the detail sidebar
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto">
                {filteredTags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-xs hover:bg-base-200"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  </li>
                ))}
                {filteredTags.length === 0 && allTags.length > 0 && (
                  <li className="px-2 py-1 text-xs text-base-content/50">No matching tags</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default Filters;
