import { useState, useMemo, useEffect } from 'react';
import { imagesStore } from '../stores/images';
import Skeleton from './Skeleton';
import ImageCard from './ImageCard';
import ResponsivePagination from 'react-responsive-pagination';
import 'react-responsive-pagination/themes/minimal.css';
import '../custom.css';
import { useFilteredImages } from '../hooks/useFilteredImages';
import PlaylistTrack from './PlaylistTrack';
import { motion, AnimatePresence } from 'framer-motion';
import { registerOnDelete } from '../hooks/useOnDeleteImage';
const { openContextMenuGallery } = window.API_RENDERER;
function PaginatedGallery() {
    const { skeletonsToShow, filters } = imagesStore();
    registerOnDelete();
    const [imagesPerPage] = useState(20);
    const filteredImages = useFilteredImages();
    const [currentPage, setCurrentPage] = useState<number>(1);
    const lastImageIndex = currentPage * imagesPerPage;
    const firstImageIndex = lastImageIndex - imagesPerPage;
    const totalPages = useMemo(() => {
        return Math.ceil(filteredImages.length / imagesPerPage);
    }, [filteredImages, skeletonsToShow, imagesPerPage]);
    const SkeletonsArray = useMemo(() => {
        if (skeletonsToShow !== undefined) {
            return skeletonsToShow.fileNames.map((imageName, index) => {
                const imagePath = skeletonsToShow.imagePaths[index];
                return <Skeleton key={imagePath} imageName={imageName} />;
            });
        }
        return [];
    }, [skeletonsToShow]);
    const imagesToShow = useMemo(() => {
        const imageCardJsxArray: JSX.Element[] = [];
        if (filters.order === 'desc') {
            for (let idx = firstImageIndex; idx < lastImageIndex; idx++) {
                const currentImage = filteredImages[idx];
                if (currentImage === undefined) break;
                const imageJsxElement = (
                    <ImageCard key={currentImage.id} Image={currentImage} />
                );
                imageCardJsxArray.push(imageJsxElement);
            }
        } else {
            for (let idx = filteredImages.length - 1; idx >= 0; idx--) {
                const imageJsxElement = (
                    <ImageCard
                        key={filteredImages[idx].id}
                        Image={filteredImages[idx]}
                    />
                );
                imageCardJsxArray.push(imageJsxElement);
            }
        }
        return [...SkeletonsArray, ...imageCardJsxArray];
    }, [filteredImages, filters, currentPage, totalPages]);
    function handlePageChange(page: number) {
        setCurrentPage(page);
    }
    useEffect(() => {
        if (imagesToShow.length === 0) {
            setCurrentPage(totalPages);
        }
        if (filters.searchString === '') {
            setCurrentPage(1);
        }
    }, [imagesPerPage, totalPages, filters]);
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
