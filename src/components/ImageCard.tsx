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
	const { monitorSelection } = useMonitorStore();
	const addImageToPlaylist = playlistStore(useShallow((s) => s.addImagesToPlaylist));
	const readPlaylist = playlistStore(useShallow((s) => s.readPlaylist));
	const removeImageFromPlaylist = playlistStore(useShallow((s) => s.removeImagesFromPlaylist));
	const isEmpty = playlistStore(useShallow((s) => s.isEmpty));
	const imagesInPlaylist = playlistStore(useShallow((s) => s.playlistImagesSet));
	const { addToSelectedImages, removeFromSelectedImages, selectedImages } = imagesStore();

	const [isChecked, setIsChecked] = useState(false);
	const isSelected = selectedImages.has(Image.id);

	useEffect(() => {
		const shouldBeChecked = !isEmpty && imagesInPlaylist.has(Image.id);
		setIsChecked(shouldBeChecked);
	}, [isEmpty, imagesInPlaylist, Image]);

	const handleDoubleClick = () => {
		if (!Image.id) {
			console.error("Cannot set image - missing id", { Image });
			return;
		}

		const monitor =
			monitorSelection.selectedMonitors.length === 1
				? monitorSelection.selectedMonitors[0]
				: "*";

		goDaemon.setWallpaper(Image.id, monitor, monitorSelection.mode);
	};

	const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
		event.stopPropagation();
		const { checked } = event.currentTarget;

		if (checked) {
			const playlist = readPlaylist();
			if (
				playlist.configuration.type === "day_of_week" &&
				playlist.images.length >= 7
			) {
				return;
			}
			addImageToPlaylist([Image.id]);
		} else {
			removeImageFromPlaylist(new Set([Image.id]));
		}

		setIsChecked(checked);
	};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isHotkeyPressed("ctrl")) {
			if (isSelected) {
				removeFromSelectedImages(Image);
			} else {
				addToSelectedImages(Image);
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
					{Image.thumbnails?.default?.trim() && (
						<source
							media="(width < 1279px)"
							srcSet={Image.thumbnails.default}
						/>
					)}
					<img
						ref={imgRef}
						className="transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center w-full h-auto aspect-[3/2] object-cover"
						src={Image.thumbnails?.default?.trim() || Image.path}
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
