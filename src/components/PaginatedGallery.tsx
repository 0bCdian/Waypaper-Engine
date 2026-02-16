import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import PlaylistTrack from "./PlaylistTrack";
import { useImagePagination } from "../hooks/useImagePagination";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { useImagesStore } from "../stores/images";

function PaginatedGallery() {
	const { imagesToShow, handlePageChange, currentPage, totalPages } =
		useImagePagination();
	const selectedImages = useImagesStore((s) => s.selectedImages);
	const ref = useRef<HTMLDivElement>(null);

	const handleContextMenu = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (window.API_RENDERER?.openContextMenu) {
			void window.API_RENDERER.openContextMenu({
				Image: undefined,
				selectedImagesLength: selectedImages.size,
			});
		}
	};

	return (
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
				className="flex-1 min-h-0 flex flex-col gap-4 transition focus:outline-hidden p-4"
				onContextMenu={handleContextMenu}
			>
				{/* Scrollable image grid -- the only scrollable region */}
				<div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm">
					<div
						className="m-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(16vw,1fr))] gap-3 md:gap-3 lg:gap-3 xl:gap-4 2xl:gap-5"
					>
						{imagesToShow}
					</div>
				</div>

				{/* Pinned bottom: pagination + playlist track */}
				<div className="shrink-0 flex w-full flex-col justify-between gap-4 pt-3">
					<div className="w-[75%] self-center flex flex-col items-center gap-2">
						<ResponsivePagination
							total={totalPages}
							previousClassName="rounded_button_previous"
							nextClassName="rounded_button_next"
							current={currentPage}
							onPageChange={(page: number) => {
								handlePageChange(page);
							}}
						/>
						{totalPages > 1 && (
							<span className="text-xs text-base-content/50">
								Page {currentPage} of {totalPages}
							</span>
						)}
					</div>
					<PlaylistTrack />
				</div>
			</motion.div>
		</AnimatePresence>
	);
}

export default PaginatedGallery;
