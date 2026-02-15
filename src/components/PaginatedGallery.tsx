import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import PlaylistTrack from "./PlaylistTrack";
import { useImagePagination } from "../hooks/useImagePagination";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { imagesStore } from "../stores/images";

function PaginatedGallery() {
	const {
		imagesToShow,
		handlePageChange,
		currentPage,
		totalPages,
	} = useImagePagination();
	const { selectedImages } = imagesStore();
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
				className="h-full flex flex-col justify-between gap-4 overflow-y-auto transition focus:outline-hidden p-4"
				onContextMenu={handleContextMenu}
			>
				<div className="flex flex-col items-center overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm">
					<div
						className={`m-auto min-h-[full] ${
							imagesToShow.length === 1
								? "items-center"
								: "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(clamp(280px,25vw,400px),1fr))] gap-3 md:gap-4 lg:gap-4 xl:gap-5 2xl:gap-6"
						}`}
					>
						{imagesToShow}
					</div>
				</div>
				<div className="flex w-full flex-col justify-between gap-12 pt-3">
					<div className="w-[75%] self-center">
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
					<PlaylistTrack />
				</div>
			</motion.div>
		</AnimatePresence>
	);
}

export default PaginatedGallery;
