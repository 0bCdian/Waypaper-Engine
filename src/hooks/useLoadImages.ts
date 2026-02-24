import { useEffect, useRef } from "react";
import { useImagesStore } from "../stores/images";

export function useLoadImages() {
	const reQueryImages = useImagesStore((state) => state.reQueryImages);
	const hasLoaded = useRef(false);

	useEffect(() => {
		if (hasLoaded.current) return;
		hasLoaded.current = true;
		reQueryImages();
	}, [reQueryImages]);
}
