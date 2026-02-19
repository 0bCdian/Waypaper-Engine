import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
	useWallhavenStore,
	type WallhavenCategory,
	type WallhavenPurity,
	type WallhavenSorting,
	type WallhavenWallpaper,
} from "../stores/wallhavenStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { cn } from "../utils/cn";

const SORTING_OPTIONS: { value: WallhavenSorting; label: string }[] = [
	{ value: "date_added", label: "Date Added" },
	{ value: "relevance", label: "Relevance" },
	{ value: "random", label: "Random" },
	{ value: "views", label: "Views" },
	{ value: "favorites", label: "Favorites" },
	{ value: "toplist", label: "Top List" },
];

function WallhavenPage() {
	const config = useSettingsStore((s) => s.config);
	const isNeo = useDesignSystemStore((s) => s.designMode === "neobrutalist");

	const {
		filters,
		results,
		meta,
		isLoading,
		error,
		downloadingIds,
		setQuery,
		toggleCategory,
		togglePurity,
		setSorting,
		setPage,
		search,
		selectWallpaper,
		downloadToGallery,
	} = useWallhavenStore(
		useShallow((s) => ({
			filters: s.filters,
			results: s.results,
			meta: s.meta,
			isLoading: s.isLoading,
			error: s.error,
			downloadingIds: s.downloadingIds,
			setQuery: s.setQuery,
			toggleCategory: s.toggleCategory,
			togglePurity: s.togglePurity,
			setSorting: s.setSorting,
			setPage: s.setPage,
			search: s.search,
			selectWallpaper: s.selectWallpaper,
			downloadToGallery: s.downloadToGallery,
		})),
	);

	const selectedWallpaper = useWallhavenStore((s) => s.selectedWallpaper);

	const apiKey = config?.wallhaven?.api_key ?? "";
	const isEnabled = config?.wallhaven?.enabled ?? false;

	const [inputValue, setInputValue] = useState(filters.query);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const doSearch = useCallback(
		(page?: number) => {
			if (page !== undefined) setPage(page);
			void search(apiKey || undefined);
		},
		[search, apiKey, setPage],
	);

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setQuery(inputValue);
		setTimeout(() => doSearch(1), 0);
	};

	useEffect(() => {
		if (isEnabled && results.length === 0 && !isLoading) {
			doSearch();
		}
	}, [isEnabled]);

	if (!isEnabled) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 text-base-content/50">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-16 w-16"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				<p className="text-lg font-medium">Wallhaven is disabled</p>
				<p className="text-sm">
					Enable it in Settings &rarr; Wallhaven to browse wallpapers.
				</p>
			</div>
		);
	}

	const categoryBtn = (cat: WallhavenCategory, label: string) => (
		<button
			type="button"
			className={cn(
				"btn btn-xs",
				filters.categories[cat]
					? "btn-primary"
					: "btn-ghost btn-outline",
			)}
			onClick={() => {
				toggleCategory(cat);
				setTimeout(() => doSearch(1), 0);
			}}
		>
			{label}
		</button>
	);

	const purityBtn = (pur: WallhavenPurity, label: string) => (
		<button
			type="button"
			className={cn(
				"btn btn-xs",
				filters.purity[pur]
					? pur === "nsfw"
						? "btn-error"
						: pur === "sketchy"
							? "btn-warning"
							: "btn-success"
					: "btn-ghost btn-outline",
			)}
			onClick={() => {
				togglePurity(pur);
				setTimeout(() => doSearch(1), 0);
			}}
		>
			{label}
		</button>
	);

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="shrink-0 p-4 border-b border-base-content/10 flex flex-wrap items-center gap-3">
				<form
					onSubmit={handleSearchSubmit}
					className="flex items-center gap-2 flex-1 min-w-[200px]"
				>
					<input
						ref={searchInputRef}
						type="text"
						className="input input-bordered input-sm flex-1"
						placeholder="Search wallpapers…"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
					/>
					<button type="submit" className="btn btn-sm btn-primary">
						Search
					</button>
				</form>

				<div className="flex items-center gap-1">
					<span className="text-xs text-base-content/50 mr-1">
						Category:
					</span>
					{categoryBtn("general", "General")}
					{categoryBtn("anime", "Anime")}
					{categoryBtn("people", "People")}
				</div>

				<div className="flex items-center gap-1">
					<span className="text-xs text-base-content/50 mr-1">
						Purity:
					</span>
					{purityBtn("sfw", "SFW")}
					{purityBtn("sketchy", "Sketchy")}
					{apiKey && purityBtn("nsfw", "NSFW")}
				</div>

				<select
					className="select select-bordered select-sm"
					value={filters.sorting}
					onChange={(e) => {
						setSorting(e.target.value as WallhavenSorting);
						setTimeout(() => doSearch(1), 0);
					}}
				>
					{SORTING_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</div>

			{/* Error */}
			{error && (
				<div className="px-4 py-2 bg-error/10 text-error text-sm">
					{error}
				</div>
			)}

			{/* Results */}
			<div className="flex-1 min-h-0 overflow-y-auto p-4">
				{isLoading && results.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<span className="loading loading-spinner loading-lg" />
					</div>
				) : results.length === 0 ? (
					<div className="flex items-center justify-center h-full text-base-content/40">
						No results. Try a different search.
					</div>
				) : (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
						{results.map((wp) => (
							<WallhavenCard
								key={wp.id}
								wp={wp}
								isNeo={isNeo}
								isDownloading={downloadingIds.has(wp.id)}
								onSelect={() => selectWallpaper(wp)}
								onDownload={() => void downloadToGallery(wp)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Pagination */}
			{meta && meta.last_page > 1 && (
				<div className="shrink-0 flex items-center justify-center gap-2 py-3 border-t border-base-content/10">
					<button
						className="btn btn-sm"
						disabled={filters.page <= 1}
						onClick={() => doSearch(filters.page - 1)}
					>
						Prev
					</button>
					<span className="text-sm text-base-content/60">
						Page {meta.current_page} of {meta.last_page} ({meta.total}{" "}
						wallpapers)
					</span>
					<button
						className="btn btn-sm"
						disabled={filters.page >= meta.last_page}
						onClick={() => doSearch(filters.page + 1)}
					>
						Next
					</button>
				</div>
			)}

			{/* Detail Modal */}
			{selectedWallpaper && (
				<WallhavenDetailModal
					wp={selectedWallpaper}
					isNeo={isNeo}
					isDownloading={downloadingIds.has(selectedWallpaper.id)}
					onClose={() => selectWallpaper(null)}
					onDownload={() => void downloadToGallery(selectedWallpaper)}
				/>
			)}
		</div>
	);
}

function WallhavenCard({
	wp,
	isNeo,
	isDownloading,
	onSelect,
	onDownload,
}: {
	wp: WallhavenWallpaper;
	isNeo: boolean;
	isDownloading: boolean;
	onSelect: () => void;
	onDownload: () => void;
}) {
	return (
		<div
			className={cn(
				"group relative cursor-pointer overflow-hidden bg-base-200",
				isNeo
					? "border-2 border-base-content/80 shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]"
					: "rounded-lg",
			)}
		>
			<img
				src={wp.thumbs.small}
				alt={`Wallhaven ${wp.id}`}
				className="w-full aspect-video object-cover transition-transform group-hover:scale-105"
				loading="lazy"
				onClick={onSelect}
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
			<div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
				<div className="flex flex-col gap-0.5">
					<span className="text-xs text-white/80 font-mono">
						{wp.resolution}
					</span>
					<div className="flex gap-1">
						<span className="badge badge-xs badge-ghost text-white/70">
							{wp.category}
						</span>
						<span className="badge badge-xs badge-ghost text-white/70">
							{wp.purity}
						</span>
					</div>
				</div>
				<button
					type="button"
					className={cn(
						"btn btn-xs btn-primary",
						isDownloading && "btn-disabled",
					)}
					onClick={(e) => {
						e.stopPropagation();
						onDownload();
					}}
				>
					{isDownloading ? (
						<span className="loading loading-spinner loading-xs" />
					) : (
						"↓"
					)}
				</button>
			</div>
		</div>
	);
}

function WallhavenDetailModal({
	wp,
	isNeo,
	isDownloading,
	onClose,
	onDownload,
}: {
	wp: WallhavenWallpaper;
	isNeo: boolean;
	isDownloading: boolean;
	onClose: () => void;
	onDownload: () => void;
}) {
	return (
		<div
			className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className={cn(
					"bg-base-100 max-w-4xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden",
					isNeo
						? "border-3 border-base-content/80 shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]"
						: "rounded-xl shadow-2xl",
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex-1 min-h-0 overflow-hidden bg-base-200 flex items-center justify-center">
					<img
						src={wp.thumbs.original || wp.thumbs.large}
						alt={`Wallhaven ${wp.id}`}
						className="max-w-full max-h-[65vh] object-contain"
					/>
				</div>
				<div className="shrink-0 p-4 flex items-center justify-between border-t border-base-content/10">
					<div className="flex flex-col gap-1">
						<span className="font-mono text-sm">
							{wp.resolution} &middot;{" "}
							{(wp.file_size / 1024 / 1024).toFixed(1)} MB &middot;{" "}
							{wp.file_type.split("/")[1]?.toUpperCase()}
						</span>
						<div className="flex gap-1">
							<span className="badge badge-sm">{wp.category}</span>
							<span className="badge badge-sm">{wp.purity}</span>
							<span className="badge badge-sm badge-ghost">
								{wp.favorites} ♥
							</span>
							<span className="badge badge-sm badge-ghost">
								{wp.views} views
							</span>
						</div>
						{wp.colors && wp.colors.length > 0 && (
							<div className="flex gap-1 mt-1">
								{wp.colors.map((c) => (
									<div
										key={c}
										className="w-4 h-4 rounded-sm border border-base-content/20"
										style={{ backgroundColor: c }}
										title={c}
									/>
								))}
							</div>
						)}
					</div>
					<div className="flex items-center gap-2">
						<a
							href={wp.url}
							target="_blank"
							rel="noopener noreferrer"
							className="btn btn-sm btn-ghost"
						>
							Open on Wallhaven
						</a>
						<button
							type="button"
							className={cn(
								"btn btn-sm btn-primary",
								isDownloading && "btn-disabled",
							)}
							onClick={onDownload}
						>
							{isDownloading ? (
								<span className="loading loading-spinner loading-xs" />
							) : (
								"Download to Gallery"
							)}
						</button>
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={onClose}
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default WallhavenPage;
