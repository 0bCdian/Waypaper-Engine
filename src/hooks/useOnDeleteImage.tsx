import { imagesStore } from "../stores/images";
import { playlistStore } from "../stores/playlist";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { MENU_EVENTS } from "../../shared/constants";
import { type rendererImage } from "../types/rendererTypes";
import type { Image } from "../../electron/daemon-go-types";

const { onMenuEvent } = window.API_RENDERER;
let firstCall = true;

export function registerOnDelete() {
	const removeImagesFromStore = imagesStore(
		useShallow((state) => state.removeImagesFromStore),
	);
	const removeImageFromPlaylist = playlistStore(
		useShallow((state) => state.removeImagesFromPlaylist),
	);

	useEffect(() => {
		if (!firstCall) return;
		firstCall = false;

		const handleDeleteImageFromGallery = (...args: unknown[]) => {
			const image = args[0] as Image;
			if (!image) return;

			const imageToRemove: rendererImage = {
				id: image.id,
				name: image.name,
				path: image.path,
				media_type: image.media_type,
				width: image.width,
				height: image.height,
				format: image.format,
				file_size: image.file_size,
				checksum: image.checksum,
				tags: image.tags,
				imported_at: image.imported_at,
				source_path: image.source_path,
				is_selected: false,
				thumbnails: image.thumbnails,
				time: null,
			};

			removeImagesFromStore([imageToRemove]);
			removeImageFromPlaylist(new Set([image.id]));
		};

		onMenuEvent(MENU_EVENTS.deleteImageFromGallery, handleDeleteImageFromGallery);
	}, []);
}
