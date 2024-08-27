import { useCallback } from "react";
import { imagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
let firstRender = true;

export function useLoadImages() {
    const reQueryImages = imagesStore(useShallow(state => state.reQueryImages));
    const loadImages = useCallback(() => {
        if (!firstRender) return;
        firstRender = false;
        reQueryImages();
    }, [firstRender]);
    return loadImages;
}
