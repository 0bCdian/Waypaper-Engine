import ResponsivePagination from 'react-responsive-pagination';
import 'react-responsive-pagination/themes/minimal.css';
import '../custom.css';
import PlaylistTrack from './PlaylistTrack';
import { motion, AnimatePresence } from 'framer-motion';
import { registerOnDelete } from '../hooks/useOnDeleteImage';
import { useImagePagination } from '../hooks/useImagePagination';
const { openContextMenuGallery } = window.API_RENDERER;
function PaginatedGallery() {
    registerOnDelete();
    const { handlePageChange, imagesToShow, currentPage, totalPages } =
        useImagePagination();
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="transition justify-between gap-4 sm:w-[90%] m-auto flex flex-col overflow-clip min-h-[87%] max-h-[87%]"
                onContextMenu={e => {
                    e.stopPropagation();
                    openContextMenuGallery();
                }}
            >
                <div className="overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 scrollbar-thumb-rounded-sm items-center flex flex-col">
                    <div
                        className={`md:grid [min-height:full] md:auto-cols-auto m-auto ${
                            imagesToShow.length === 1
                                ? 'items-center'
                                : 'md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:w-full'
                        }`}
                    >
                        {imagesToShow}
                    </div>
                </div>
                <div className="flex pt-3 flex-col w-full justify-between gap-12">
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
