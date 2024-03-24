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
const date = new Date();
let initialTimeStamp = date.getHours() * 60 + date.getMinutes();
interface State {
    playlist: rendererPlaylist;
    isEmpty: boolean;
}

interface Actions {
    addImageToPlaylist: (Image: rendererImage) => void;
    addMultipleImagesToPlaylist: (Images: rendererImage[]) => void;
    setConfiguration: (newConfiguration: configuration) => void;
    setName: (newName: string) => void;
    movePlaylistArrayOrder: (newlyOrderedArray: rendererImage[]) => void;
    removeImageFromPlaylist: (Image: rendererImage) => void;
    clearPlaylist: () => void;
    readPlaylist: () => rendererPlaylist;
    setPlaylist: (newPlaylist: rendererPlaylist) => void;
    setEmptyPlaylist: () => void;
}

const playlistStore = create<State & Actions>()((set, get) => ({
    playlist: initialPlaylistState,
    isEmpty: true,
    addImageToPlaylist: (Image: rendererImage) => {
        if (initialTimeStamp >= 1440) {
            // one minute offset every loop in the day, to avoid as much duplication of timestamps as possible
            initialTimeStamp -= 1439;
        }
        Image.time = initialTimeStamp;
        initialTimeStamp += 5;
        set(state => {
            const newImages = [...state.playlist.images, Image];
            const newState = {
                ...state,
                playlist: { ...state.playlist, images: newImages },
                isEmpty: false
            };
            return newState;
        });
    },
    addMultipleImagesToPlaylist: (Images: rendererImage[]) => {
        for (let current = 0; current < Images.length; current++) {
            if (initialTimeStamp >= 1440) {
                // one minute offset every loop in the day, to avoid as much duplication of timestamps as possible
                initialTimeStamp -= 1439;
            }
            Images[current].time = initialTimeStamp;
            initialTimeStamp += 5;
        }
        set(state => {
            const newImages = [...state.playlist.images, ...Images];
            const newState = {
                ...state,
                playlist: { ...state.playlist, images: newImages },
                isEmpty: false
            };
            return newState;
        });
    },
    setConfiguration: (newConfiguration: configuration) => {
        set(state => {
            return {
                ...state,
                playlist: { ...state.playlist, configuration: newConfiguration }
            };
        });
    },
    setName: (newName: string) => {
        set(state => {
            return { ...state, playlist: { ...state.playlist, name: newName } };
        });
    },
    movePlaylistArrayOrder: (newlyOrderedArray: rendererImage[]) => {
        set(state => {
            return {
                ...state,
                playlist: { ...state.playlist, images: newlyOrderedArray }
            };
        });
    },
    removeImageFromPlaylist: (Image: rendererImage) => {
        set(state => {
            const newImages = state.playlist.images.filter(
                element => element.id !== Image.id
            );
            return {
                ...state,
                playlist: { ...state.playlist, images: newImages }
            };
        });
    },
    clearPlaylist: () => {
        const currentPlaylist = get().playlist;
        stopPlaylist({
            name: currentPlaylist.name,
            monitor: currentPlaylist.monitor
        });
        set(state => {
            return {
                ...state,
                playlist: initialPlaylistState,
                isEmpty: true
            };
        });
    },
    readPlaylist: () => {
        return get().playlist;
    },
    setPlaylist: (newPlaylist: rendererPlaylist) => {
        set(state => {
            return {
                ...state,
                playlist: newPlaylist,
                isEmpty: false
            };
        });
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
export default playlistStore;
