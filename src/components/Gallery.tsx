import { useShallow } from "zustand/react/shallow";
import { useLoadImages } from "../hooks/useLoadImages";
import { useImagesStore } from "../stores/images";
import AddImagesCard from "./AddImagesCard";
import PaginatedGallery from "./PaginatedGallery";
import Filters from "./Filters";
function Gallery() {
	const isEmpty = useImagesStore(useShallow((state) => state.isEmpty));
	const isQueried = useImagesStore(useShallow((state) => state.isQueried));
	useLoadImages()();
	if (isEmpty && isQueried)
		return (
			<div className="h-full flex flex-col items-center justify-center p-4">
				<AddImagesCard />
			</div>
		);
	return (
		<div className="h-full flex flex-col overflow-hidden">
			<Filters />
			<PaginatedGallery />
		</div>
	);
}

export default Gallery;
