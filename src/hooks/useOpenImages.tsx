import { create } from 'zustand';
import { type openFileAction, type imagesObject } from '../../shared/types';
import {
    type rendererImage,
    type rendererPlaylist
} from '../types/rendererTypes';
const { openFiles, handleOpenImages } = window.API_RENDERER;
interface State {
    isActive: boolean;
}
interface openImagesProps {
    setSkeletons: (skeletons: imagesObject | undefined) => void;
    addImages: (imagesArray: rendererImage[]) => void;
    addMultipleImagesToPlaylist: (Images: rendererImage[]) => void;
    addImageToPlaylist: (Image: rendererImage) => void;
    currentPlaylist: rendererPlaylist;
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
        addMultipleImagesToPlaylist,
        addImageToPlaylist,
        currentPlaylist,
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
            let playlistImagesLength = currentPlaylist.images.length;
            let shouldCheckImage = true;
            switch (currentPlaylist.configuration.playlistType) {
                // todo limit somehow when I implement this type of playlist
                case 'dayofweek':
                    if (playlistImagesLength < 7) {
                        addImageToPlaylist({
                            ...image,
                            isChecked: shouldCheckImage,
                            time: null
                        });
                    } else {
                        shouldCheckImage = false;
                    }
                    playlistImagesLength++;
            }
            return {
                ...image,
                isChecked: shouldCheckImage,
                time: null
            };
        });
        setSkeletons(undefined);
        addImages(newImagesAdded);
        if (currentPlaylist.configuration.playlistType === 'dayofweek') {
            return;
        }
        addMultipleImagesToPlaylist(newImagesAdded);
    }
}));

export default openImagesStore;
