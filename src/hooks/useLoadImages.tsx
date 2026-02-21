import { useRef } from "react";
import { useImagesStore } from "../stores/images";

export function useLoadImages() {
	const reQueryImages = useImagesStore((state) => state.reQueryImages);
	const hasLoaded = useRef(false);
	const loadImages = () => {
		if (hasLoaded.current) return;
		hasLoaded.current = true;
		reQueryImages();
	};
	return loadImages;
}
