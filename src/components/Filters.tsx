import { type ChangeEvent, useEffect, useState, useRef, useMemo } from "react";
import useDebounce from "../hooks/useDebounce";
import type { Filters as FiltersType } from "../types/rendererTypes";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import type { ImageQueryParams } from "../../electron/daemon-go-types";
import { useDesignSystemStore } from "../stores/designSystemStore";

const { goDaemon } = window.API_RENDERER;

interface PartialFilters {
	order: "asc" | "desc";
	type: "name" | "id";
	searchString: string;
	tags: string[];
}
const initialFilters: PartialFilters = {
	order: "desc",
	type: "id",
	searchString: "",
	tags: [],
};

function mapFiltersToQueryParams(f: PartialFilters): Partial<ImageQueryParams> {
	return {
		sort_by: f.type === "name" ? "name" : "imported_at",
		sort_order: f.order,
		search: f.searchString || undefined,
		tags: f.tags.length > 0 ? f.tags.join(",") : undefined,
	};
}

function Filters() {
	const { setFilters, filters } = useImagesStore(
		useShallow((s) => ({
			setFilters: s.setFilters,
			filters: s.filters,
		})),
	);
	const [partialFilters, setPartialFilters] = useState(initialFilters);
	const [allTags, setAllTags] = useState<string[]>([]);
	const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
	const [tagSearch, setTagSearch] = useState("");
	const tagRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		void goDaemon.getImageTags().then((resp) => {
			setAllTags(resp.tags ?? []);
		}).catch(() => {});
	}, []);

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
		return allTags.filter(
			(t) => !selected.has(t) && t.toLowerCase().includes(term),
		);
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
				.fetchPage(1, mapFiltersToQueryParams(partialFilters));
		},
		200,
		[partialFilters],
	);
	useEffect(() => {
		const resetFilters: FiltersType = {
			...partialFilters,
			advancedFilters: filters.advancedFilters,
		};
		setFilters(resetFilters);
	}, [filters.advancedFilters]);
	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);
	return (
		<section className={`group mt-10 mb-5 flex flex-wrap justify-center gap-2${isNeo ? " neo-filters-strip" : ""}`}>
			<div className="tooltip" data-tip="more filters">
				<button
					className="btn btn-active rounded-xl uppercase"
					onClick={() => {
						// @ts-expect-error workaround for daisyui
						window.AdvancedFiltersModal.showModal();
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
			<input
				onChange={onTextChange}
				type="text"
				id="default-search"
				className="input input-primary w-1/6 rounded-xl border-0 bg-base-300 text-center text-xl font-medium sm:w-1/4"
				placeholder="Search"
			/>

			{/* Tag filter */}
			{allTags.length > 0 && (
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
										<span
											key={tag}
											className="badge badge-primary badge-sm cursor-pointer gap-1"
											onClick={() => toggleTag(tag)}
										>
											{tag} &times;
										</span>
									))}
								</div>
							)}

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
								{filteredTags.length === 0 && (
									<li className="px-2 py-1 text-xs text-base-content/50">
										No matching tags
									</li>
								)}
							</ul>
						</div>
					)}
				</div>
			)}
		</section>
	);
}

export default Filters;
