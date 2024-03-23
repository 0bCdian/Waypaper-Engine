import { useState, useMemo, useEffect } from 'react';
import { imagesStore } from '../stores/images';
import Skeleton from './Skeleton';
import ImageCard from './ImageCard';
import PlaylistTrack from './PlaylistTrack';
import { motion } from 'framer-motion';
import ResponsivePagination from 'react-responsive-pagination';
import 'react-responsive-pagination/themes/minimal.css';
import '../custom.css';
import { useFilteredImages } from '../hooks/useFilteredImages';
const { openContextMenuGallery } = window.API_RENDERER;

function PaginatedGallery() {
    const { skeletonsToShow, filters } = imagesStore();
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
    const imagesCardArray = useMemo(() => {
        const imageCardJsxArray: JSX.Element[] = [];
        if (filters.order === 'desc') {
            for (let idx = 0; idx < filteredImages.length; idx++) {
                const imageJsxElement = (
                    <ImageCard
                        key={filteredImages[idx].id}
                        Image={filteredImages[idx]}
                    />
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
        return imageCardJsxArray;
    }, [filteredImages, filters]);
    const imagesToShow = useMemo(
        function () {
            const imagesToShow = [...SkeletonsArray, ...imagesCardArray].slice(
                firstImageIndex,
                lastImageIndex
            );
            return imagesToShow;
        },
        [
            imagesPerPage,
            currentPage,
            totalPages,
            filteredImages,
            skeletonsToShow,
            filters
        ]
    );
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
        <div
            className="transition justify-normal sm:w-[90%] m-auto flex flex-col overflow-clip [contain:paint] min-h-[85%] "
            onContextMenu={e => {
                e.stopPropagation();
                openContextMenuGallery();
            }}
        >
            <div className="max-h-[0] min-h-[55vh] overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 scrollbar-thumb-rounded items-center flex flex-col">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 2 }}
                    exit={{ opacity: 0 }}
                    className={`md:grid md:auto-cols-auto m-auto ${
                        imagesToShow.length === 1
                            ? 'items-center'
                            : 'md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:w-full'
                    }`}
                >
                    {imagesToShow}
                </motion.div>
            </div>
            <div className="flex pt-3 flex-col w-full justify-between flex-grow">
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
        </div>
    );
}

export default PaginatedGallery;
