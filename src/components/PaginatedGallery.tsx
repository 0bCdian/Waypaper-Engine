import { useState, useMemo, useEffect } from "react";
import { useImages } from "../hooks/imagesStore";
import Skeleton from "./Skeleton";
import ImageCard from "./ImageCard";
import PlaylistTrack from "./PlaylistTrack";
import { motion } from "framer-motion";
import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
const { openContextMenuGallery } = window.API_RENDERER;
function PaginatedGallery() {
    const { filteredImages, skeletonsToShow, filters } = useImages();
    const [imagesPerPage] = useState(20);
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
        return filteredImages.map(image => {
            return <ImageCard key={image.id} Image={image} />;
        });
    }, [filteredImages]);
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
            skeletonsToShow
        ]
    );
    function handlePageChange(page: number) {
        setCurrentPage(page);
    }
    useEffect(() => {
        if (imagesToShow.length === 0) {
            setCurrentPage(totalPages);
        }
        if (filters.searchString === "") {
            setCurrentPage(1);
        }
    }, [imagesPerPage, totalPages, filters.searchString]);

    return (
        <div
            className=" transition justify-between sm:w-[90%] m-auto flex flex-col max-h-[85%] scrollbar-none"
            onContextMenu={e => {
                e.stopPropagation();
                openContextMenuGallery();
            }}
        >
            <div className=" max-h-[90%] min-h-0 overflow-y-scroll scrollbar-none items-center flex flex-col">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`md:grid md:auto-cols-auto m-auto ${
                        imagesToShow.length === 1
                            ? "items-center"
                            : "md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:w-full"
                    }`}
                >
                    {imagesToShow}
                </motion.div>
            </div>
            <div className="flex pt-3 flex-col w-full gap-5 flex-grow">
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
