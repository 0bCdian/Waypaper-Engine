import { create } from "zustand";
import type {
	PlaylistImage,
	PlaylistConfiguration,
} from "../../electron/daemon-go-types";
import type { rendererPlaylist } from "../types/rendererTypes";

const configurationInitial: PlaylistConfiguration = {
	type: "timer",
	interval: 300,
	order: "ordered",
	show_animations: true,
	always_start_on_first_image: false,
};

const initialPlaylistState: rendererPlaylist = {
	images: [],
	configuration: configurationInitial,
	name: "",
};

interface State {
	playlist: rendererPlaylist;
	isEmpty: boolean;
	playlistImagesSet: Set<number>;
	playlistImagesTimeSet: Set<number>;
	lastAddedImageID: number;
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
}

export const usePlaylistStore = create<State & Actions>()((set, get) => ({
	playlist: initialPlaylistState,
	isEmpty: true,
	playlistImagesSet: new Set<number>(),
	playlistImagesTimeSet: new Set<number>(),
	lastAddedImageID: -1,

	addImagesToPlaylist: (imageIds: number[]) => {
		const playlistImagesSet = get().playlistImagesSet;
		const playlistImagesTimeSet = get().playlistImagesTimeSet;
		const currentPlaylist = get().playlist;

		if (currentPlaylist.configuration.type === "day_of_week") {
			const availableSpace = 7 - currentPlaylist.images.length;
			if (availableSpace <= 0) return;
			imageIds = imageIds.slice(0, availableSpace);
		}

		const imagesToAdd: PlaylistImage[] = [];
		const date = new Date();
		let initialTimeStamp = Math.max(
			...[...playlistImagesTimeSet],
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

		set((state) => {
			const newImages = [...state.playlist.images, ...imagesToAdd];
			const newPlaylist = { ...state.playlist, images: newImages };
			return {
				playlist: newPlaylist,
				isEmpty: false,
				playlistImagesSet: new Set(playlistImagesSet),
				playlistImagesTimeSet: new Set(playlistImagesTimeSet),
				lastAddedImageID: newPlaylist.images.at(-1)?.image_id || -1,
			};
		});
	},

	setConfiguration: (newConfiguration) => {
		set((state) => ({
			playlist: { ...state.playlist, configuration: newConfiguration },
		}));
	},

	setName: (newName) => {
		set((state) => ({
			playlist: { ...state.playlist, name: newName },
		}));
	},

	movePlaylistArrayOrder: (newlyOrderedArray) => {
		set((state) => ({
			playlist: { ...state.playlist, images: newlyOrderedArray },
		}));
	},

	removeImagesFromPlaylist: (imageIds) => {
		set((state) => {
			const newImagesArray = state.playlist.images.filter((img) => {
				const shouldKeep = !imageIds.has(img.image_id);
				if (!shouldKeep && img.time != null) {
					state.playlistImagesTimeSet.delete(img.time);
				}
				return shouldKeep;
			});
			imageIds.forEach((id) => {
				state.playlistImagesSet.delete(id);
			});
			return {
				playlist: { ...state.playlist, images: newImagesArray },
				playlistImagesSet: new Set(state.playlistImagesSet),
				playlistImagesTimeSet: new Set(state.playlistImagesTimeSet),
			};
		});
	},

	clearPlaylist: () => {
		set(() => ({
			playlist: initialPlaylistState,
			isEmpty: true,
			playlistImagesSet: new Set<number>(),
			playlistImagesTimeSet: new Set<number>(),
			lastAddedImageID: -1,
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

		newPlaylist.images.forEach((img) => {
			newPlaylistImagesSet.add(img.image_id);
			if (img.time == null) {
				initialTimeStamp += 5;
				if (initialTimeStamp >= 1440) {
					initialTimeStamp -= 1439;
				}
				while (newPlaylistImagesTimeSet.has(initialTimeStamp)) {
					initialTimeStamp++;
				}
				img.time = initialTimeStamp;
			}
			newPlaylistImagesTimeSet.add(img.time);
		});

		set(() => ({
			playlist: newPlaylist,
			isEmpty: false,
			playlistImagesSet: newPlaylistImagesSet,
			playlistImagesTimeSet: newPlaylistImagesTimeSet,
		}));
	},

	setEmptyPlaylist: () => {
		set(() => ({
			playlist: initialPlaylistState,
			isEmpty: true,
			playlistImagesSet: new Set<number>(),
			playlistImagesTimeSet: new Set<number>(),
			lastAddedImageID: -1,
		}));
	},
}));
