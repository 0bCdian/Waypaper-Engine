import { create } from 'zustand';
import { type openFileAction, type imagesObject } from '../../shared/types';
import { type rendererImage } from '../types/rendererTypes';
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
        const imagesArray = await handleOpenImages(imagesObject);
        const newImagesAdded = imagesArray.map(image => {
            const shouldCheckImage = true;
            return {
                ...image,
                isChecked: shouldCheckImage,
                time: null
            };
        });
        setSkeletons(undefined);
        addImages(newImagesAdded);
        addImagesToPlaylist(newImagesAdded);
    }
}));

export default openImagesStore;
