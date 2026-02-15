import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { motion } from "framer-motion";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";
import { imagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { playlistStore } from "../stores/playlist";
import type { rendererImage } from "../types/rendererTypes";

interface ImageCardProps {
	Image: rendererImage;
}

const { goDaemon } = window.API_RENDERER;

function ImageCard({ Image }: ImageCardProps) {
	const imgRef = useRef<HTMLImageElement>(null);
	const overlayId = useId();
	const { activeMonitor } = useMonitorStore();
	// Zustand selectors
	const addImageToPlaylist = playlistStore(useShallow((s) => s.addImagesToPlaylist));
	const readPlaylist = playlistStore(useShallow((s) => s.readPlaylist));
	const removeImageFromPlaylist = playlistStore(useShallow((s) => s.removeImagesFromPlaylist));
	const isEmpty = playlistStore(useShallow((s) => s.isEmpty));
	const imagesInPlaylist = playlistStore(useShallow((s) => s.playlistImagesSet));
	const { addToSelectedImages, removeFromSelectedImages, selectedImages } = imagesStore();

	// Initialize selection object if missing
	if (!Image.selection) {
		Image.selection = {
			isChecked: false,
			isSelected: false,
			selectedAt: undefined,
			selectedPlaylists: [],
		};
	}

	// Local state synced with Image.selection
	const [isChecked, setIsChecked] = useState(Image.selection?.isChecked ?? false);
	const isSelected = selectedImages.has(Image.id);

	// Sync checkbox state with playlist
	useEffect(() => {
		const shouldBeChecked = !isEmpty && imagesInPlaylist.has(Image.id);
		setIsChecked(shouldBeChecked);
		if (Image.selection) {
			Image.selection.isChecked = shouldBeChecked;
		}
	}, [isEmpty, imagesInPlaylist, Image]);

	// Sync selection state with store
	useEffect(() => {
		if (isSelected) {
			addToSelectedImages(Image);
		} else {
			removeFromSelectedImages(Image);
		}
	}, [isSelected, addToSelectedImages, removeFromSelectedImages, Image]);

	const handleDoubleClick = () => {
		if (!Image.id || !activeMonitor?.name) {
			console.error("Cannot set image - missing id or monitor", { Image, activeMonitor });
			return;
		}

		if (activeMonitor.extendAcrossMonitors && activeMonitor.monitors?.length > 1) {
			goDaemon.setImageAcrossMonitors(Image.id, Image.name, activeMonitor);
		} else {
			goDaemon.setImage(Image.id, Image.name, activeMonitor.name);
		}
	};

	const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
		event.stopPropagation();
		const { checked } = event.currentTarget;

		if (checked) {
			const playlist = readPlaylist();
			// Prevent adding more than 7 images to dayofweek playlists
			if (playlist.configuration.type === "dayofweek" && playlist.images.length >= 7) {
				return;
			}
			addImageToPlaylist([Image]);
		} else {
			removeImageFromPlaylist(new Set([Image.id]));
		}
		
		setIsChecked(checked);
		if (Image.selection) {
			Image.selection.isChecked = checked;
		}
	};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isHotkeyPressed("ctrl")) {
			const newSelected = !isSelected;
			if (Image.selection) {
				Image.selection.isSelected = newSelected;
			}
			if (newSelected) {
				addToSelectedImages(Image);
			} else {
				removeFromSelectedImages(Image);
			}
		}
	};

	const handleRightClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		window.API_RENDERER?.openContextMenu?.({
			Image,
			selectedImagesLength: selectedImages.size,
		});
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			onContextMenu={handleRightClick}
			onClick={handleClick}
			className="group relative w-full overflow-hidden rounded-lg duration-200"
		>
			<input
				checked={isChecked}
				id={Image.name}
				onChange={handleCheckboxChange}
				type="checkbox"
				className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-xs opacity-0 checked:opacity-100 group-hover:opacity-100"
			/>

			<button
				type="button"
				onDoubleClick={handleDoubleClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleDoubleClick();
					}
				}}
				className="relative w-full h-full border-0 bg-transparent p-0 cursor-pointer"
				aria-label={`Set ${Image.name} as wallpaper`}
			>
				<picture className="block w-full h-full">
					{Image.thumbnails?.["4k"]?.trim() && (
						<source
							media="(width >= 3840px)"
							srcSet={Image.thumbnails["4k"]}
						/>
					)}
					{Image.thumbnails?.["1440p"]?.trim() && (
						<source
							media="(width >= 2560px)"
							srcSet={Image.thumbnails["1440p"]}
						/>
					)}
					{Image.thumbnails?.["1080p"]?.trim() && (
						<source
							media="(width >= 1920px)"
							srcSet={Image.thumbnails["1080p"]}
						/>
					)}
					{Image.thumbnails?.["720p"]?.trim() && (
						<source
							media="(width >= 1280px)"
							srcSet={Image.thumbnails["720p"]}
						/>
					)}
					{Image.thumbnails?.fallback?.trim() && (
						<source
							media="(width < 1279px)"
							srcSet={Image.thumbnails.fallback}
						/>
					)}
					{/* Fallback img - uses fallback thumbnail or full image path */}
					<img
						ref={imgRef}
						className="transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center w-full h-auto aspect-[3/2] object-cover"
						src={Image.thumbnails?.fallback?.trim() || Image.path}
						alt={Image.name}
						draggable={false}
						loading="lazy"
						onError={({ currentTarget }) => {
							currentTarget.onerror = null;
							currentTarget.src = Image.path;
						}}
					/>
				</picture>
				<p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis bg-base-content/75 p-2 pl-2 text-justify text-lg font-medium opacity-0 transition-all duration-300 group-hover:opacity-100 text-base-100">
					{Image.name}
				</p>
				<div
					data-selected={isSelected}
					id={overlayId}
					className="absolute top-0 z-10 h-full w-full bg-primary opacity-0 transition-all data-[selected=true]:opacity-45"
					aria-hidden="true"
				/>
			</button>
		</motion.div>
	);
}

export default ImageCard;
