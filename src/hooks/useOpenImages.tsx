import { create } from 'zustand';
import { type openFileAction, type imagesObject } from '../../shared/types';
import { type Image } from '../../shared/types/image';
import { type rendererPlaylist } from '../types/rendererTypes';
const { openFiles, handleOpenImages } = window.API_RENDERER;
interface State {
    isActive: boolean;
}
interface openImagesProps {
    setSkeletons: (skeletons: imagesObject | undefined) => void;
    setImagesArray: (imagesArray: Image[]) => void;
    addMultipleImagesToPlaylist: (Images: Image[]) => void;
    addImageToPlaylist: (Image: Image) => void;
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
        setImagesArray,
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
            let shouldCheckImage;
            switch (currentPlaylist.configuration.playlistType) {
                case 'never':
                    shouldCheckImage = true;
                    break;
                case 'timer':
                    shouldCheckImage = true;
                    break;
                case 'timeofday':
                    // todo limit somehow when I implement this type of playlist
                    shouldCheckImage = true;
                    break;
                case 'dayofweek':
                    if (playlistImagesLength < 7) {
                        shouldCheckImage = true;
                        addImageToPlaylist({
                            ...image,
                            isChecked: shouldCheckImage
                        });
                    } else {
                        shouldCheckImage = false;
                    }
                    playlistImagesLength++;
            }
            return {
                ...image,
                isChecked: shouldCheckImage
            };
        });
        setSkeletons(undefined);
        setImagesArray(newImagesAdded);
        if (currentPlaylist.configuration.playlistType === 'dayofweek') {
            return;
        }
        addMultipleImagesToPlaylist(newImagesAdded);
    }
}));

export default openImagesStore;
