import { create } from "zustand";
import { type openFileAction, type imagesObject } from "../../shared/types";
const { openFiles, handleOpenImages } = window.API_RENDERER;

interface State {
    isActive: boolean;
}

interface openImagesProps {
    action: openFileAction;
}

interface Actions {
    openImages: (openImagesProps: openImagesProps) => Promise<void>;
}

const openImagesStore = create<State & Actions>(set => ({
    isActive: false,
    openImages: async ({ action }) => {
        set(() => ({ isActive: true }));
        const imagesObject: imagesObject | undefined = await openFiles(action);
        set(() => ({ isActive: false }));
        
        if (imagesObject === undefined) return;
        
        // Send images to daemon for processing
        await handleOpenImages(imagesObject);
        // Progress will be handled by real-time events
        // Images will appear automatically as they're processed
    }
}));

export default openImagesStore;
