import { create } from "zustand";
import {
    type rendererImage,
    type rendererPlaylist,
    type configuration
} from "../types/rendererTypes";
import { type ActiveMonitor, type Monitor } from "../../shared/types/monitor";
import { useMonitorStore } from "./monitors";
const imagesInitial: rendererImage[] = [];
const configurationInitial: rendererPlaylist["configuration"] = {
    type: "timer",
    interval: 3_600_000,
    order: "ordered",
    showAnimations: true,
    alwaysStartOnFirstImage: false
};
const initialPlaylistState: rendererPlaylist = {
    images: imagesInitial,
    configuration: configurationInitial,
    name: "",
    activeMonitor: {
        name: "",
        extendAcrossMonitors: false,
        monitors: [] as Monitor[]
    }
};
interface State {
    playlist: rendererPlaylist;
    isEmpty: boolean;
    playlistImagesSet: Set<number>;
    playlistImagesTimeSet: Set<number>;
    lastAddedImageID: number;
}

interface Actions {
    addImagesToPlaylist: (Images: rendererImage[]) => void;
    setConfiguration: (newConfiguration: configuration) => void;
    setName: (newName: string) => void;
    movePlaylistArrayOrder: (newlyOrderedArray: rendererImage[]) => void;
    removeImagesFromPlaylist: (Images: Set<number>) => void;
    clearPlaylist: (playlistToDelete?: {
        name: string;
        activeMonitor: ActiveMonitor;
    }) => void;
    readPlaylist: () => rendererPlaylist;
    setPlaylist: (newPlaylist: rendererPlaylist) => void;
    setEmptyPlaylist: () => void;
    setActiveMonitorPlaylist: (activeMonitor: ActiveMonitor) => void;
}

export const playlistStore = create<State & Actions>()((set, get) => ({
    playlist: initialPlaylistState,
    isEmpty: true,
    playlistImagesSet: new Set<number>(),
    playlistImagesTimeSet: new Set<number>(),
    lastAddedImageID: -1,
    addImagesToPlaylist: Images => {
        const playlistImagesSet = get().playlistImagesSet;
        const playlistImagesTimeSet = get().playlistImagesTimeSet;
        const currentPlaylist = get().playlist;
        if (currentPlaylist.configuration.type === "dayofweek") {
            const availableSpace = 7 - currentPlaylist.images.length;
            if (availableSpace <= 0) return;
            else {
                Images = Images.slice(0, availableSpace);
            }
        }
        const imagesToAdd: rendererImage[] = [];
        const highestTimeStamp = Math.max(...playlistImagesTimeSet);
        const date = new Date();
        let initialTimeStamp = Math.max(
            highestTimeStamp,
            date.getHours() * 60 + date.getMinutes()
        );
        for (let current = 0; current < Images.length; current++) {
            if (playlistImagesSet.has(Images[current].id)) {
                continue;
            }
            initialTimeStamp += 5;
            if (initialTimeStamp >= 1440) {
                initialTimeStamp -= 1439;
            }
            while (playlistImagesTimeSet.has(initialTimeStamp)) {
                initialTimeStamp++;
            }
            Images[current].time = initialTimeStamp;
            Images[current].isChecked = true;
            playlistImagesSet.add(Images[current].id);
            playlistImagesTimeSet.add(initialTimeStamp);
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
                playlistImagesSet: new Set(playlistImagesSet),
                playlistImagesTimeSet: new Set(playlistImagesTimeSet),
                lastAddedImageID: newPlaylist.images.at(-1)?.id
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
    setActiveMonitorPlaylist: activeMonitor => {
        set(state => ({
            playlist: { ...state.playlist, activeMonitor }
        }));
    },
    movePlaylistArrayOrder: newlyOrderedArray => {
        set(state => ({
            playlist: { ...state.playlist, images: newlyOrderedArray }
        }));
    },
    removeImagesFromPlaylist: Images => {
        set(state => {
            const newImagesArray = state.playlist.images.filter(image => {
                const shouldNotFilter = !Images.has(image.id);
                if (Images.has(image.id) && image.time !== null) {
                    state.playlistImagesTimeSet.delete(image.time);
                }
                return shouldNotFilter;
            });
            Images.forEach(id => {
                state.playlistImagesSet.delete(id);
            });
            return {
                playlist: {
                    ...state.playlist,
                    images: newImagesArray
                },
                playlistImagesSet: new Set(state.playlistImagesSet),
                playlistImagesTimeSet: new Set(state.playlistImagesTimeSet)
            };
        });
    },
    clearPlaylist: playlistToDelete => {
        const activeMonitor = useMonitorStore.getState().activeMonitor;
        const currentPlaylist = get().playlist;
        if (
            playlistToDelete === undefined ||
            (currentPlaylist.name === playlistToDelete.name &&
                currentPlaylist.activeMonitor.name ===
                    playlistToDelete.activeMonitor.name)
        ) {
            set(() => {
                const emptyPlaylist = {
                    ...initialPlaylistState,
                    activeMonitor
                };
                return {
                    playlist: emptyPlaylist,
                    isEmpty: true,
                    playlistImagesSet: new Set<number>(),
                    playlistImagesTimeSet: new Set<number>(),
                    lastAddedImageID: -1
                };
            });
        }
    },
    readPlaylist: () => {
        return get().playlist;
    },

    setPlaylist: (newPlaylist: rendererPlaylist) => {
        const newPlaylistImagesSet = new Set<number>();
        const newPlaylistImagesTimeSet = new Set<number>();
        const date = new Date();
        let initialTimeStamp = date.getHours() * 60 + date.getMinutes();
        newPlaylist.images.forEach(image => {
            newPlaylistImagesSet.add(image.id);
            if (image.time === null || image.time === undefined) {
                initialTimeStamp += 5;
                if (initialTimeStamp >= 1440) {
                    initialTimeStamp -= 1439;
                }
                while (newPlaylistImagesTimeSet.has(initialTimeStamp)) {
                    initialTimeStamp++;
                }
                image.time = initialTimeStamp;
            }
            newPlaylistImagesTimeSet.add(image.time);
        });
        set(() => ({
            playlist: newPlaylist,
            isEmpty: false,
            playlistImagesSet: newPlaylistImagesSet,
            playlistImagesTimeSet: newPlaylistImagesTimeSet
        }));
    },
    setEmptyPlaylist: () => {
        set(() => ({
            playlist: initialPlaylistState,
            isEmpty: true,
            playlistImagesSet: new Set<number>(),
            playlistImagesTimeSet: new Set<number>(),
            lastAddedImageID: -1
        }));
    }
}));
