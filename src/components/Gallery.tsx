import { useShallow } from "zustand/react/shallow";
import { useLoadImages } from "../hooks/useLoadImages";
import { imagesStore } from "../stores/images";
import AddImagesCard from "./AddImagesCard";
import PaginatedGallery from "./PaginatedGallery";
import Filters from "./Filters";
function Gallery() {
    const isEmpty = imagesStore(useShallow(state => state.isEmpty));
    const isQueried = imagesStore(useShallow(state => state.isQueried));
    useLoadImages()();
    if (isEmpty && isQueried)
        return (
            <div className="m-auto flex flex-col items-center justify-center sm:h-[90dvh]">
                <AddImagesCard />
            </div>
        );
    return (
        <>
            <Filters />
            <PaginatedGallery />
        </>
    );
}

export default Gallery;
