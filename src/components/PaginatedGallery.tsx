import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import PlaylistTrack from "./PlaylistTrack";
import { useImagePagination } from "../hooks/useImagePagination";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
const { openContextMenu } = window.API_RENDERER;

function PaginatedGallery() {
    const {
        imagesToShow,
        handlePageChange,
        currentPage,
        totalPages,
        selectedImages
    } = useImagePagination();
    const ref = useRef<HTMLDivElement>(null);
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
                className="m-auto flex max-h-[84vh] min-h-[86vh] flex-col justify-between gap-4 overflow-y-hidden transition focus:outline-none sm:w-[90%]"
                onContextMenu={e => {
                    e.stopPropagation();
                    openContextMenu({
                        Image: undefined,
                        selectedImagesLength: selectedImages.size
                    });
                }}
            >
                <div className="flex flex-col items-center overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 scrollbar-thumb-rounded-sm">
                    <div
                        className={`m-auto [min-height:full] md:grid md:auto-cols-auto ${
                            imagesToShow.length === 1
                                ? "items-center"
                                : "md:w-full md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]"
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
