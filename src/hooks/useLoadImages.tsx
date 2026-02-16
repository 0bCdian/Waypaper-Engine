import { useImagesStore } from "../stores/images";
let firstRender = true;

export function useLoadImages() {
	const reQueryImages = useImagesStore((state) => state.reQueryImages);
	const loadImages = () => {
		if (!firstRender) return;
		firstRender = false;
		reQueryImages();
	};
	return loadImages;
}
