import { create } from 'zustand';
import {
    type rendererImage,
    type rendererPlaylist,
    type configuration
} from '../types/rendererTypes';
import { type Monitor } from '../../shared/types/monitor';
const imagesInitial: rendererImage[] = [];
const { stopPlaylist } = window.API_RENDERER;
const configurationInitial: rendererPlaylist['configuration'] = {
    playlistType: 'timer',
    interval: 3_600_000,
    order: 'ordered',
    showAnimations: true
};

const initialPlaylistState: rendererPlaylist = {
    images: imagesInitial,
    configuration: configurationInitial,
    name: '',
    monitor: {
        name: '',
        extendAcrossMonitors: false,
        monitor: [] as Monitor[]
    }
};
interface State {
    playlist: rendererPlaylist;
    isEmpty: boolean;
    playlistImagesSet: Set<number>;
}

interface Actions {
    addImagesToPlaylist: (Images: rendererImage[]) => void;
    setConfiguration: (newConfiguration: configuration) => void;
    setName: (newName: string) => void;
    movePlaylistArrayOrder: (newlyOrderedArray: rendererImage[]) => void;
    removeImagesFromPlaylist: (Images: Set<number>) => void;
    clearPlaylist: () => void;
    readPlaylist: () => rendererPlaylist;
    setPlaylist: (newPlaylist: rendererPlaylist) => void;
    setEmptyPlaylist: () => void;
}

export const playlistStore = create<State & Actions>()((set, get) => ({
    playlist: initialPlaylistState,
    isEmpty: true,
    playlistImagesSet: new Set<number>(),
    addImagesToPlaylist: Images => {
        if (get().playlist.configuration.playlistType === 'dayofweek') {
            const availableSpace = 7 - get().playlist.images.length;
            if (availableSpace <= 0) return;
            else {
                Images = Images.slice(0, availableSpace);
            }
        }
        const imagesToAdd: rendererImage[] = [];
        const newPlaylistImagesSet = new Set(get().playlistImagesSet);
        const highestTimeStamp = get().playlist.images.at(-1)?.time;
        const date = new Date();
        let initialTimeStamp =
            highestTimeStamp ?? date.getHours() * 60 + date.getMinutes();
        for (let current = 0; current < Images.length; current++) {
            if (newPlaylistImagesSet.has(Images[current].id)) {
                continue;
            }
            if (initialTimeStamp >= 1440) {
                // one minute offset every loop in the day, to avoid as much duplication of timestamps as possible
                initialTimeStamp -= 1439;
            }
            initialTimeStamp += 5;
            Images[current].time = initialTimeStamp;
            Images[current].isChecked = true;
            newPlaylistImagesSet.add(Images[current].id);
            imagesToAdd.push(Images[current]);
        }
        set(state => {
            const newImages = [...state.playlist.images, ...imagesToAdd];
            const newPlaylist = {
                ...state.playlist,
                images: newImages
            };
            return {
                playlist: newPlaylist,
                isEmpty: false,
                playlistImagesSet: newPlaylistImagesSet
            };
        });
    },
    setConfiguration: newConfiguration => {
        set(state => {
            return {
                playlist: { ...state.playlist, configuration: newConfiguration }
            };
        });
    },
    setName: newName => {
        set(state => {
            return { playlist: { ...state.playlist, name: newName } };
        });
    },
    movePlaylistArrayOrder: newlyOrderedArray => {
        set(state => ({
            playlist: { ...state.playlist, images: newlyOrderedArray }
        }));
    },
    removeImagesFromPlaylist: Images => {
        set(state => {
            const newImagesArray = state.playlist.images.filter(
                image => !Images.has(image.id)
            );
            Images.forEach(id => {
                state.playlistImagesSet.delete(id);
            });
            return {
                playlist: {
                    ...state.playlist,
                    images: newImagesArray
                },
                playlistImagesSet: new Set(state.playlistImagesSet)
            };
        });
    },
    clearPlaylist: () => {
        const currentPlaylist = get().playlist;
        stopPlaylist({
            name: currentPlaylist.name,
            monitor: currentPlaylist.monitor
        });
        set(() => {
            return {
                playlist: initialPlaylistState,
                isEmpty: true,
                playlistImagesSet: new Set<number>()
            };
        });
    },
    readPlaylist: () => {
        return get().playlist;
    },
    setPlaylist: (newPlaylist: rendererPlaylist) => {
        const newPlaylistSet = new Set<number>();
        newPlaylist.images.forEach(image => {
            newPlaylistSet.add(image.id);
        });
        set(() => ({
            playlist: newPlaylist,
            isEmpty: false,
            playlistImagesSet: newPlaylistSet
        }));
    },
    setEmptyPlaylist: () => {
        set(state => {
            return {
                ...state,
                playlist: initialPlaylistState,
                isEmpty: true
            };
        });
    }
}));
