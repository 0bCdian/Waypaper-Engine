import { type ChangeEvent, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { type rendererImage } from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useImageState } from "../hooks/useImageState";

interface EnhancedImageCardProps {
	image?: rendererImage;
	imageId?: number;
	isProcessing?: boolean;
}

function SkeletonCard({ imageName }: { imageName: string }) {
	return (
		<div className="relative mb-4 min-h-[199.00px] max-w-[300px] rounded-lg bg-neutral">
			<span className="loading loading-spinner loading-lg absolute right-34 top-20"></span>
			<p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis rounded-b-lg bg-base-content/75 p-2 pl-2 text-justify text-lg font-medium text-base-100">
				{imageName}
			</p>
		</div>
	);
}

function EnhancedImageCard({
	image,
	imageId,
	isProcessing = false,
}: EnhancedImageCardProps) {
	const { getThumbnailPath, isImageProcessing, getCompletedImage } =
		useImageState();
	const { selectedImages, addToSelectedImages, removeFromSelectedImages } =
		imagesStore();

	const isCurrentlyProcessing =
		isProcessing || (imageId ? isImageProcessing(imageId) : false);

	const actualImage =
		image || (imageId ? getCompletedImage(imageId) : undefined);

	const memoizedImage = useMemo(
		() => actualImage,
		[actualImage?.id, actualImage?.name],
	);

	const isSelected = memoizedImage
		? selectedImages.has(memoizedImage.id)
		: false;

	const [thumbnailSrc, setThumbnailSrc] = useState<string>("");

	useEffect(() => {
		if (!memoizedImage || thumbnailSrc) {
			return;
		}

		if (memoizedImage.thumbnails) {
			const screenWidth = window.innerWidth;
			const path = getThumbnailPath(memoizedImage.thumbnails, screenWidth);
			if (path) {
				setThumbnailSrc(path);
			}
		}

		if (!thumbnailSrc && memoizedImage.path) {
			setThumbnailSrc(memoizedImage.path);
		}
	}, [memoizedImage, thumbnailSrc, getThumbnailPath]);

	const handleSelectionChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (!memoizedImage) return;
		if (e.target.checked) {
			addToSelectedImages(memoizedImage);
		} else {
			removeFromSelectedImages(memoizedImage);
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (memoizedImage && window.API_RENDERER?.openContextMenu) {
			void window.API_RENDERER.openContextMenu({
				Image: memoizedImage,
				selectedImagesLength: selectedImages.size,
			});
		}
	};

	const handleClick = (_e: React.MouseEvent) => {
		if (!memoizedImage) return;
		if (isHotkeyPressed("ctrl") || isHotkeyPressed("meta")) {
			if (isSelected) {
				removeFromSelectedImages(memoizedImage);
			} else {
				addToSelectedImages(memoizedImage);
			}
		}
	};

	if (isCurrentlyProcessing) {
		return <SkeletonCard imageName={memoizedImage?.name || "Processing..."} />;
	}

	if (!memoizedImage) {
		return <SkeletonCard imageName="Loading..." />;
	}

	return (
		<motion.div
			className={`relative mb-4 max-w-[300px] rounded-lg bg-base-100 shadow-lg transition-all duration-200 ${
				isSelected ? "ring-2 ring-primary" : ""
			}`}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			onClick={handleClick}
			onContextMenu={handleContextMenu}
		>
			<input
				type="checkbox"
				className="checkbox-primary checkbox absolute left-2 top-2 z-10"
				checked={isSelected}
				onChange={handleSelectionChange}
				onClick={(e) => e.stopPropagation()}
			/>

			<div className="relative">
				{thumbnailSrc ? (
					<img
						src={thumbnailSrc}
						alt={memoizedImage.name}
						className="h-48 w-full rounded-t-lg object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-48 w-full items-center justify-center rounded-t-lg bg-neutral">
						<span className="loading loading-spinner loading-md"></span>
					</div>
				)}
			</div>

			<div className="p-3">
				<h3 className="truncate text-sm font-medium text-base-content">
					{memoizedImage.name}
				</h3>
				<p className="mt-1 text-xs text-base-content/70">
					{memoizedImage.width} x {memoizedImage.height}
				</p>
				<p className="text-xs text-base-content/70">
					{memoizedImage.format?.toUpperCase()}
				</p>
			</div>
		</motion.div>
	);
}

export default EnhancedImageCard;
