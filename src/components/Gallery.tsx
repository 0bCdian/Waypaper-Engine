import { useShallow } from 'zustand/react/shallow';
import { useLoadImages } from '../hooks/useLoadImages';
import { imagesStore } from '../stores/images';
import AddImagesCard from './AddImagesCard';
import Filters from './Filters';
import PaginatedGallery from './PaginatedGallery';
function Gallery() {
    const isEmpty = imagesStore(useShallow(state => state.isEmpty));
    const isQueried = imagesStore(useShallow(state => state.isQueried));
    useLoadImages()();
    if (isEmpty && isQueried)
        return (
            <div className="flex flex-col justify-center items-center h-[90dvh] m-auto overflow-hidden">
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
