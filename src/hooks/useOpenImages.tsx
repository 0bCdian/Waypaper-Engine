import { create } from "zustand";
import { type openFileAction, type imagesObject } from "../../shared/types";
import { type rendererImage } from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
const { openFiles, handleOpenImages } = window.API_RENDERER;
interface State {
    isActive: boolean;
}
interface openImagesProps {
    setSkeletons: (skeletons: imagesObject | undefined) => void;
    addImages: (imagesArray: rendererImage[]) => void;
    addImagesToPlaylist: (Images: rendererImage[]) => void;
    action: openFileAction;
}

interface Actions {
    openImages: (openImagesProps: openImagesProps) => Promise<void>;
}

const openImagesStore = create<State & Actions>(set => ({
    isActive: false,
    openImages: async ({
        setSkeletons,
        addImages,
        addImagesToPlaylist,
        action
    }) => {
        set(() => ({ isActive: true }));
        const imagesObject: imagesObject | undefined = await openFiles(action);
        set(() => ({ isActive: false }));
        if (imagesObject === undefined) return;
        imagesObject.fileNames.reverse();
        imagesObject.imagePaths.reverse();
        setSkeletons(imagesObject);
        await handleOpenImages(imagesObject);
        // Skeletons will be cleared by the real-time processing hook when processing_complete event fires
        // Refresh images from database after processing
        const { reQueryImages } = imagesStore.getState();
        reQueryImages();
    }
}));

export default openImagesStore;
