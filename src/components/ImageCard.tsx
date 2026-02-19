import { useId, useRef } from "react";
import type { ChangeEvent } from "react";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";
import { useImagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { usePlaylistStore } from "../stores/playlist";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { buildImageMenuItems } from "../utils/contextMenuItems";
import type { rendererImage } from "../types/rendererTypes";

interface ImageCardProps {
	Image: rendererImage;
}

const { goDaemon } = window.API_RENDERER;

function ImageCard({ Image }: ImageCardProps) {
	const imgRef = useRef<HTMLImageElement>(null);
	const overlayId = useId();
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const {
		addImagesToPlaylist: addImageToPlaylist,
		readPlaylist,
		removeImagesFromPlaylist: removeImageFromPlaylist,
		isEmpty,
		playlistImagesSet: imagesInPlaylist,
	} = usePlaylistStore(
		useShallow((s) => ({
			addImagesToPlaylist: s.addImagesToPlaylist,
			readPlaylist: s.readPlaylist,
			removeImagesFromPlaylist: s.removeImagesFromPlaylist,
			isEmpty: s.isEmpty,
			playlistImagesSet: s.playlistImagesSet,
		})),
	);
	const { addToSelectedImages, removeFromSelectedImages, selectedImages } =
		useImagesStore(
			useShallow((s) => ({
				addToSelectedImages: s.addToSelectedImages,
				removeFromSelectedImages: s.removeFromSelectedImages,
				selectedImages: s.selectedImages,
			})),
		);

	const isPolaroid = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist" && s.neoConfig.polaroidCards,
	);

	const isChecked = !isEmpty && imagesInPlaylist.has(Image.id);
	const isSelected = selectedImages.has(Image.id);

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

	const openContextMenu = useContextMenuStore((s) => s.open);
	const monitorsList = useMonitorStore((s) => s.monitorsList);

	const handleRightClick = (e: React.MouseEvent) => {
		const items = buildImageMenuItems(Image, monitorsList, selectedImages.size);
		openContextMenu(e, items);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleDoubleClick();
		}
	};

	const openDetail = useImageDetailStore((s) => s.open);
	const handleOpenDetail = (e: React.MouseEvent) => {
		e.stopPropagation();
		openDetail(Image as unknown as import("../../electron/daemon-go-types").Image);
	};

	const pictureElement = (
		<picture className={isPolaroid ? "neo-polaroid-image" : "block w-full h-full"}>
			{Image.thumbnails?.["4k"]?.trim() && (
				<source media="(width >= 7680px)" srcSet={Image.thumbnails["4k"]} />
			)}
			{Image.thumbnails?.["1440p"]?.trim() && (
				<source
					media="(width >= 2560px)"
					srcSet={Image.thumbnails["1440p"]}
				/>
			)}
			{Image.thumbnails?.["1080p"]?.trim() && (
				<source
					media="(width >= 720px)"
					srcSet={Image.thumbnails["1080p"]}
				/>
			)}
			{Image.thumbnails?.["720p"]?.trim() && (
				<source
					media="(width >= 300px)"
					srcSet={Image.thumbnails["720p"]}
				/>
			)}
			{Image.thumbnails?.default?.trim() && (
				<source
					media="(width < 720px)"
					srcSet={Image.thumbnails.default}
				/>
			)}
			<img
				ref={imgRef}
				className={
					isPolaroid
						? "w-full h-auto aspect-[3/2] object-cover block"
						: "transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center w-full h-auto aspect-[3/2] object-cover"
				}
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
	);

	if (isPolaroid) {
		return (
			<div
				onContextMenu={handleRightClick}
				onClick={handleClick}
				className="neo-polaroid group relative w-full animate-fade-in"
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
					onClick={handleOpenDetail}
					className="btn btn-ghost btn-xs btn-square absolute left-2 top-2 z-20 opacity-0 group-hover:opacity-100"
					title="Edit details"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
						<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
					</svg>
				</button>

				<button
					type="button"
					onDoubleClick={handleDoubleClick}
					onKeyDown={handleKeyDown}
					className="neo-polaroid-inner"
					aria-label={`Set ${Image.name} as wallpaper`}
				>
					{pictureElement}
					<div className="neo-polaroid-caption">
						<p className="neo-polaroid-name">
							{Image.name}
							{Image.format && (
								<span className="ml-1.5 inline-block rounded bg-base-300/80 px-1 py-0.5 align-middle text-[0.6rem] font-semibold uppercase leading-none text-base-content/70">
									{Image.format}
								</span>
							)}
						</p>
					</div>
				</button>

				<div
					data-selected={isSelected}
					id={overlayId}
					className="neo-polaroid-overlay"
					aria-hidden="true"
				/>
			</div>
		);
	}

	return (
		<div
			onContextMenu={handleRightClick}
			onClick={handleClick}
			className="group relative w-full overflow-hidden rounded-lg duration-200 animate-fade-in"
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
				onClick={handleOpenDetail}
				className="btn btn-ghost btn-xs btn-square absolute left-2 top-2 z-20 opacity-0 group-hover:opacity-100"
				title="Edit details"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
					<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
				</svg>
			</button>

			<button
				type="button"
				onDoubleClick={handleDoubleClick}
				onKeyDown={handleKeyDown}
				className="relative w-full h-full border-0 bg-transparent p-0 cursor-pointer"
				aria-label={`Set ${Image.name} as wallpaper`}
			>
				{pictureElement}
				<p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis bg-base-content/75 p-2 pl-2 text-justify text-lg font-medium opacity-0 transition-all duration-300 group-hover:opacity-100 text-base-100">
					{Image.name}
					{Image.format && (
						<span className="ml-1.5 inline-block rounded bg-base-100/20 px-1 py-0.5 align-middle text-[0.6rem] font-semibold uppercase leading-none">
							{Image.format}
						</span>
					)}
				</p>
				<div
					data-selected={isSelected}
					id={overlayId}
					className="absolute top-0 z-10 h-full w-full bg-primary opacity-0 transition-all data-[selected=true]:opacity-45"
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}

export default ImageCard;
