import { useShallow } from "zustand/react/shallow";
import { useLoadImages } from "../hooks/useLoadImages";
import { useImagesStore } from "../stores/images";
import AddImagesCard from "./AddImagesCard";
import PaginatedGallery from "./PaginatedGallery";
import Filters from "./Filters";
function Gallery() {
	const isEmpty = useImagesStore(useShallow((state) => state.isEmpty));
	const isQueried = useImagesStore(useShallow((state) => state.isQueried));
	const filters = useImagesStore((s) => s.filters);
	useLoadImages()();
	const hasActiveFilters =
		filters.searchString !== "" ||
		filters.advancedFilters.formats.length < 10 ||
		filters.advancedFilters.resolution.constraint !== "all";
	if (isEmpty && isQueried && !hasActiveFilters)
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
