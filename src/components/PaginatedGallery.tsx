import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import { useMemo, useRef } from "react";
import { useDroppable } from "@dnd-kit/react";
import PlaylistTrack from "./PlaylistTrack";
import PlaylistController from "./PlaylistController";
import FolderCard from "./FolderCard";
import AppDragDropProvider from "./AppDragDropProvider";
import { useImagePagination } from "../hooks/useImagePagination";
import { motion, AnimatePresence } from "framer-motion";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { buildGalleryMenuItems } from "../utils/contextMenuItems";
import type { DropTargetData } from "../stores/dragStore";

function paginationMinWidth(totalPages: number): number {
	if (totalPages <= 1) return 0;
	const maxSlots = Math.min(totalPages + 2, 9);
	return maxSlots * 3 + (maxSlots - 1) * 0.25;
}

function GalleryDropZone({ children }: { children: React.ReactNode }) {
	const dropData = useMemo<DropTargetData>(() => ({ type: "gallery" }), []);
	const { ref } = useDroppable({
		id: "gallery-area",
		data: dropData,
		collisionPriority: -1,
	});

	return (
		<div ref={ref} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm p-4" style={{ scrollbarGutter: "stable" }}>
			{children}
		</div>
	);
}

function PaginatedGallery() {
	const { imagesToShow, handlePageChange, currentPage, totalPages } =
		useImagePagination();
	const selectedImages = useImagesStore((s) => s.selectedImages);
	const folders = useFoldersStore((s) => s.folders);
	const currentFolderId = useFoldersStore((s) => s.currentFolderId);
	const searchResults = useFoldersStore((s) => s.searchResults);
	const searchString = useImagesStore((s) => s.filters.searchString);
	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);
	const ref = useRef<HTMLDivElement>(null);
	const openContextMenu = useContextMenuStore((s) => s.open);

	const handleContextMenu = (e: React.MouseEvent) => {
		const items = buildGalleryMenuItems(selectedImages.size);
		openContextMenu(e, items);
	};

	const displayFolders = searchString ? searchResults : folders;
	const showFolders = currentPage === 1 && displayFolders.length > 0;

	return (
		<AppDragDropProvider>
			<AnimatePresence>
				<motion.div
					ref={ref}
					onHoverStart={() => {
						ref.current?.focus();
					}}
					tabIndex={-1}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
					className="flex-1 min-h-0 flex flex-col transition focus:outline-hidden"
					onContextMenu={handleContextMenu}
				>
				<GalleryDropZone>
						<AnimatePresence mode="wait">
							<motion.div
								key={`${currentFolderId ?? "root"}-${currentPage}`}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.15 }}
								className="m-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(16vw,1fr))] gap-3 md:gap-3 lg:gap-3 xl:gap-4 2xl:gap-5 [&>:only-child]:max-w-[25vw] [&>:only-child]:justify-self-center"
							>
								{showFolders &&
									displayFolders.map((folder) => (
										<FolderCard key={`folder-${folder.id}`} folder={folder} />
									))}
								{imagesToShow}
							</motion.div>
						</AnimatePresence>
					</GalleryDropZone>

					{/* Pinned bottom: pagination + playlist track */}
					<div className={`shrink-0 flex w-full min-w-0 flex-col justify-between gap-4 px-2 lg:px-4 pt-3 pb-2 overflow-hidden${isNeo ? " neo-bottom-dock" : ""}`}>
						<div className="self-center flex flex-col items-center gap-2">
							<div className="max-w-2xl min-w-1">
								<ResponsivePagination
									total={totalPages}
									previousClassName="rounded_button_previous"
									nextClassName="rounded_button_next"
									current={currentPage}
									onPageChange={(page: number) => {
										handlePageChange(page);
									}}
								/>
							</div>
							{totalPages > 1 && (
								<span className="text-xs text-base-content/50">
									Page {currentPage} of {totalPages}
								</span>
							)}
						</div>
						<PlaylistController />
						<PlaylistTrack />
					</div>
				</motion.div>
			</AnimatePresence>
		</AppDragDropProvider>
	);
}

export default PaginatedGallery;
