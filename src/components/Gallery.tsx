import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLoadImages } from "../hooks/useLoadImages";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
import AddImagesCard from "./AddImagesCard";
import PaginatedGallery from "./PaginatedGallery";
import Filters from "./Filters";
import Breadcrumbs from "./Breadcrumbs";

function Gallery() {
	const isEmpty = useImagesStore(useShallow((state) => state.isEmpty));
	const isQueried = useImagesStore(useShallow((state) => state.isQueried));
	const filters = useImagesStore((s) => s.filters);
	const currentFolderId = useFoldersStore((s) => s.currentFolderId);
	useLoadImages()();

	useEffect(() => {
		useFoldersStore.getState().fetchFolders(currentFolderId);
	}, [currentFolderId]);

	useEffect(() => {
		const { goDaemon } = window.API_RENDERER;
		const dispose = goDaemon.on("folders_updated", () => {
			const fid = useFoldersStore.getState().currentFolderId;
			useFoldersStore.getState().fetchFolders(fid);
		});
		return dispose;
	}, []);

	const hasActiveFilters =
		filters.searchString !== "" ||
		filters.advancedFilters.formats.length < 10 ||
		filters.advancedFilters.resolution.constraint !== "all" ||
		(filters.advancedFilters.colors?.length ?? 0) > 0;

	if (isEmpty && isQueried && !hasActiveFilters && currentFolderId === null) {
		const folders = useFoldersStore.getState().folders;
		if (folders.length === 0) {
			return (
				<div className="h-full flex flex-col items-center justify-center p-4">
					<AddImagesCard />
				</div>
			);
		}
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<Breadcrumbs />
			<Filters />
			<PaginatedGallery />
		</div>
	);
}

export default Gallery;
