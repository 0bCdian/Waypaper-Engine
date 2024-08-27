import { imagesStore } from "../stores/images";
import { playlistStore } from "../stores/playlist";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
const { onDeleteImageFromGallery } = window.API_RENDERER;
let firstCall = true;
export function registerOnDelete() {
    const removeImagesFromStore = imagesStore(
        useShallow(state => state.removeImagesFromStore)
    );
    const removeImageFromPlaylist = playlistStore(
        useShallow(state => state.removeImagesFromPlaylist)
    );
    useEffect(() => {
        if (!firstCall) return;
        firstCall = false;
        onDeleteImageFromGallery((_, image) => {
            removeImagesFromStore([image]);
            removeImageFromPlaylist(new Set([image.id]));
        });
    }, []);
}
