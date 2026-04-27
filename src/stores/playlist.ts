import { create } from "zustand";
import type { PlaylistImage, PlaylistConfiguration } from "../../electron/daemon-go-types";
import type { rendererPlaylist } from "../types/rendererTypes";

const STORAGE_KEY = "waypaper-playlist";

const configurationInitial: PlaylistConfiguration = {
  type: "timer",
  interval: 300,
  order: "ordered",
  always_start_on_first_image: false,
};

const defaultPlaylistState: rendererPlaylist = {
  images: [],
  configuration: configurationInitial,
  name: "",
};

function loadPersistedPlaylist(): rendererPlaylist {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPlaylistState;
    return JSON.parse(raw) as rendererPlaylist;
  } catch {
    return defaultPlaylistState;
  }
}

function persistPlaylist(playlist: rendererPlaylist) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlist));
  } catch {
    /* ignore */
  }
}

const initialPlaylistState: rendererPlaylist = loadPersistedPlaylist();

interface State {
  playlist: rendererPlaylist;
  isEmpty: boolean;
  isDirty: boolean;
  playlistImagesSet: Set<number>;
  playlistImagesTimeSet: Set<number>;
  lastAddedImageID: number;
  /** One-shot: scroll the strip to this image (set only from addImagesToPlaylist). */
  stripScrollToImageIdOnce: number | null;
}

interface Actions {
  addImagesToPlaylist: (imageIds: number[]) => void;
  setConfiguration: (newConfiguration: PlaylistConfiguration) => void;
  setName: (newName: string) => void;
  movePlaylistArrayOrder: (newlyOrderedArray: PlaylistImage[]) => void;
  removeImagesFromPlaylist: (imageIds: Set<number>) => void;
  clearPlaylist: () => void;
  readPlaylist: () => rendererPlaylist;
  setPlaylist: (newPlaylist: rendererPlaylist) => void;
  setEmptyPlaylist: () => void;
  updateImageTime: (imageId: number, oldTime: number | undefined, newTime: number) => void;
  swapImageTimes: (imageIdA: number, imageIdB: number) => void;
  markClean: () => void;
  clearStripScrollIntent: () => void;
}

function buildSets(playlist: rendererPlaylist) {
  const imagesSet = new Set<number>();
  const timesSet = new Set<number>();
  for (const img of playlist.images) {
    imagesSet.add(img.image_id);
    if (img.time != null) timesSet.add(img.time);
  }
  return { imagesSet, timesSet };
}

const _initial = buildSets(initialPlaylistState);

export const usePlaylistStore = create<State & Actions>()((set, get) => ({
  playlist: initialPlaylistState,
  isEmpty: initialPlaylistState.images.length === 0,
  isDirty: false,
  playlistImagesSet: _initial.imagesSet,
  playlistImagesTimeSet: _initial.timesSet,
  lastAddedImageID: -1,
  stripScrollToImageIdOnce: null,

  addImagesToPlaylist: (imageIds: number[]) => {
    const playlistImagesSet = new Set(get().playlistImagesSet);
    const playlistImagesTimeSet = new Set(get().playlistImagesTimeSet);
    const currentPlaylist = get().playlist;

    if (currentPlaylist.configuration.type === "day_of_week") {
      const availableSpace = 7 - currentPlaylist.images.length;
      if (availableSpace <= 0) return;
      imageIds = imageIds.slice(0, availableSpace);
    }

    const imagesToAdd: PlaylistImage[] = [];
    const date = new Date();
    let initialTimeStamp = Math.max(
      ...playlistImagesTimeSet,
      date.getHours() * 60 + date.getMinutes(),
    );

    for (const imageId of imageIds) {
      if (playlistImagesSet.has(imageId)) continue;

      initialTimeStamp += 5;
      if (initialTimeStamp >= 1440) {
        initialTimeStamp -= 1439;
      }
      while (playlistImagesTimeSet.has(initialTimeStamp)) {
        initialTimeStamp++;
      }

      playlistImagesSet.add(imageId);
      playlistImagesTimeSet.add(initialTimeStamp);

      imagesToAdd.push({
        image_id: imageId,
        time: initialTimeStamp,
      });
    }

    if (imagesToAdd.length === 0) {
      return;
    }

    set((state) => {
      const newImages = [...state.playlist.images, ...imagesToAdd];
      const newPlaylist = { ...state.playlist, images: newImages };
      const tailId = newPlaylist.images.at(-1)?.image_id;
      persistPlaylist(newPlaylist);
      return {
        playlist: newPlaylist,
        isEmpty: false,
        isDirty: true,
        playlistImagesSet,
        playlistImagesTimeSet,
        lastAddedImageID: tailId || -1,
        stripScrollToImageIdOnce: tailId != null ? tailId : null,
      };
    });
  },

  setConfiguration: (newConfiguration) => {
    set((state) => {
      const newPlaylist = { ...state.playlist, configuration: newConfiguration };
      persistPlaylist(newPlaylist);
      return { playlist: newPlaylist, isDirty: true };
    });
  },

  setName: (newName) => {
    set((state) => {
      const newPlaylist = { ...state.playlist, name: newName };
      persistPlaylist(newPlaylist);
      return { playlist: newPlaylist, isDirty: true };
    });
  },

  movePlaylistArrayOrder: (newlyOrderedArray) => {
    set((state) => {
      const newPlaylist = { ...state.playlist, images: newlyOrderedArray };
      persistPlaylist(newPlaylist);
      return { playlist: newPlaylist, isDirty: true };
    });
  },

  removeImagesFromPlaylist: (imageIds) => {
    set((state) => {
      const newImagesSet = new Set(state.playlistImagesSet);
      const newTimesSet = new Set(state.playlistImagesTimeSet);

      const newImagesArray = state.playlist.images.filter((img) => {
        const shouldKeep = !imageIds.has(img.image_id);
        if (!shouldKeep) {
          newImagesSet.delete(img.image_id);
          if (img.time != null) {
            newTimesSet.delete(img.time);
          }
        }
        return shouldKeep;
      });

      const newPlaylist = { ...state.playlist, images: newImagesArray };
      persistPlaylist(newPlaylist);
      return {
        playlist: newPlaylist,
        isDirty: true,
        playlistImagesSet: newImagesSet,
        playlistImagesTimeSet: newTimesSet,
      };
    });
  },

  clearPlaylist: () => {
    persistPlaylist(defaultPlaylistState);
    set(() => ({
      playlist: defaultPlaylistState,
      isEmpty: true,
      isDirty: false,
      playlistImagesSet: new Set<number>(),
      playlistImagesTimeSet: new Set<number>(),
      lastAddedImageID: -1,
      stripScrollToImageIdOnce: null,
    }));
  },

  readPlaylist: () => {
    return get().playlist;
  },

  setPlaylist: (newPlaylist: rendererPlaylist) => {
    const newPlaylistImagesSet = new Set<number>();
    const newPlaylistImagesTimeSet = new Set<number>();
    const date = new Date();
    let initialTimeStamp = date.getHours() * 60 + date.getMinutes();

    const fixedImages = newPlaylist.images.map((img) => {
      newPlaylistImagesSet.add(img.image_id);
      if (img.time == null) {
        initialTimeStamp += 5;
        if (initialTimeStamp >= 1440) {
          initialTimeStamp -= 1439;
        }
        while (newPlaylistImagesTimeSet.has(initialTimeStamp)) {
          initialTimeStamp++;
        }
        const fixed = { ...img, time: initialTimeStamp };
        newPlaylistImagesTimeSet.add(initialTimeStamp);
        return fixed;
      }
      newPlaylistImagesTimeSet.add(img.time);
      return img;
    });

    const playlist = { ...newPlaylist, images: fixedImages };
    persistPlaylist(playlist);
    set(() => ({
      playlist,
      isEmpty: false,
      isDirty: false,
      playlistImagesSet: newPlaylistImagesSet,
      playlistImagesTimeSet: newPlaylistImagesTimeSet,
      stripScrollToImageIdOnce: null,
    }));
  },

  setEmptyPlaylist: () => {
    persistPlaylist(defaultPlaylistState);
    set(() => ({
      playlist: defaultPlaylistState,
      isEmpty: true,
      isDirty: false,
      playlistImagesSet: new Set<number>(),
      playlistImagesTimeSet: new Set<number>(),
      lastAddedImageID: -1,
      stripScrollToImageIdOnce: null,
    }));
  },

  updateImageTime: (imageId, oldTime, newTime) => {
    set((state) => {
      const newTimeSet = new Set(state.playlistImagesTimeSet);
      if (oldTime != null) {
        newTimeSet.delete(oldTime);
      }
      newTimeSet.add(newTime);

      const newImages = state.playlist.images.map((img) =>
        img.image_id === imageId ? { ...img, time: newTime } : img,
      );

      const newPlaylist = { ...state.playlist, images: newImages };
      persistPlaylist(newPlaylist);
      return {
        playlist: newPlaylist,
        isDirty: true,
        playlistImagesTimeSet: newTimeSet,
      };
    });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  clearStripScrollIntent: () => set({ stripScrollToImageIdOnce: null }),

  swapImageTimes: (imageIdA, imageIdB) => {
    set((state) => {
      const imgA = state.playlist.images.find((img) => img.image_id === imageIdA);
      const imgB = state.playlist.images.find((img) => img.image_id === imageIdB);
      if (!imgA || !imgB) return state;

      const timeA = imgA.time;
      const timeB = imgB.time;

      const newImages = state.playlist.images.map((img) => {
        if (img.image_id === imageIdA) return { ...img, time: timeB };
        if (img.image_id === imageIdB) return { ...img, time: timeA };
        return img;
      });

      const newPlaylist = { ...state.playlist, images: newImages };
      persistPlaylist(newPlaylist);
      return {
        playlist: newPlaylist,
        isDirty: true,
      };
    });
  },
}));
