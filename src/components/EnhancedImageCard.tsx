import { type ChangeEvent, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { type rendererImage } from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useMonitorStore } from "../stores/monitors";
import { useImageState } from "../hooks/useImageState";

interface EnhancedImageCardProps {
	image?: rendererImage;
	imageId?: number; // For processing images
	isProcessing?: boolean;
}

const { goDaemon } = window.API_RENDERER;

// Skeleton component integrated into ImageCard
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
	const [selected, setSelected] = useState(
		image?.selection?.isSelected ?? false,
	);
	const [isChecked, setIsChecked] = useState(
		image?.selection?.isChecked ?? false,
	);

	// Helper function to ensure selection property exists
	const ensureSelection = (image: rendererImage) => {
		if (!image.selection) {
			image.selection = {
				isChecked: false,
				isSelected: false,
				selectedAt: undefined,
				selectedPlaylists: [],
			};
		}
		return image.selection;
	};
	const [imageSrc, setImageSrc] = useState<string>("");
	const [thumbnailSrc, setThumbnailSrc] = useState<string>("");
	const {} = useMonitorStore();

	// Determine if this card is processing
	const isCurrentlyProcessing =
		isProcessing || (imageId ? isImageProcessing(imageId) : false);

	// Get the actual image (either provided or from completed processing)
	const actualImage =
		image || (imageId ? getCompletedImage(imageId) : undefined);

	// Memoize the image object to prevent unnecessary re-renders
	const memoizedImage = useMemo(
		() => actualImage,
		[
			actualImage?.id,
			actualImage?.name,
			actualImage?.selection?.isSelected,
			actualImage?.selection?.isChecked,
		],
	);

	// Load image and thumbnail paths
	useEffect(() => {
		if (!memoizedImage || (imageSrc && thumbnailSrc)) {
			return;
		}

		const loadPaths = async () => {
			try {
				console.log(
					"🟢 EnhancedImageCard: Loading paths for image:",
					memoizedImage.name,
				);

				if (!memoizedImage.name) {
					console.error(
						"🔴 EnhancedImageCard: Image has no name!",
						memoizedImage,
					);
					return;
				}

				// Use thumbnail paths from the image if available
				if (memoizedImage.thumbnails) {
					const screenWidth = window.innerWidth;
					const thumbnailPath = getThumbnailPath(
						memoizedImage.thumbnails,
						screenWidth,
					);

					if (thumbnailPath) {
						setThumbnailSrc(thumbnailPath);
						console.log(
							"🟢 EnhancedImageCard: Using thumbnail from image data:",
							thumbnailPath,
						);
					}
				}

				// Load image path
				try {
					if (typeof goDaemon.getImageSrc === "function") {
						const imagePath = await goDaemon.getImageSrc(memoizedImage.id);
						if (imagePath) {
							setImageSrc(imagePath);
							console.log(
								"🟢 EnhancedImageCard: Setting image path:",
								imagePath,
							);
						}
					} else {
						console.warn(
							"🔴 EnhancedImageCard: getImageSrc method not available",
						);
					}
				} catch (error) {
					console.error(
						"🔴 EnhancedImageCard: Failed to get image src:",
						error,
					);
				}

				// If no thumbnail path from image data, try to get it from daemon
				if (!thumbnailSrc && memoizedImage.name) {
					try {
						if (typeof goDaemon.getThumbnailSrc === "function") {
							const thumbnailPath = await goDaemon.getThumbnailSrc(
								memoizedImage.id,
							);
							if (thumbnailPath) {
								setThumbnailSrc(thumbnailPath);
								console.log(
									"🟢 EnhancedImageCard: Setting thumbnail path:",
									thumbnailPath,
								);
							}
						} else {
							console.warn(
								"🔴 EnhancedImageCard: getThumbnailSrc method not available",
							);
						}
					} catch (error) {
						console.error(
							"🔴 EnhancedImageCard: Failed to get thumbnail src:",
							error,
						);
					}
				}
			} catch (error) {
				console.error(
					"🔴 EnhancedImageCard: Failed to load image paths:",
					error,
				);
			}
		};

		loadPaths();
	}, [memoizedImage, imageSrc, thumbnailSrc, getThumbnailPath]);

	// Handle selection changes
	const handleSelectionChange = (e: ChangeEvent<HTMLInputElement>) => {
		const newSelected = e.target.checked;
		setSelected(newSelected);

		if (memoizedImage) {
			ensureSelection(memoizedImage).isSelected = newSelected;
			imagesStore.getState().addToSelectedImages(memoizedImage);
		}
	};

	const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
		const newChecked = e.target.checked;
		setIsChecked(newChecked);

		if (memoizedImage) {
			ensureSelection(memoizedImage).isChecked = newChecked;
		}
	};

	// Handle context menu
	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (memoizedImage && window.API_RENDERER?.openContextMenu) {
			void window.API_RENDERER.openContextMenu({
				Image: memoizedImage,
				selectedImagesLength: 0,
			});
		}
	};

	// Handle click events
	const handleClick = (_e: React.MouseEvent) => {
		if (isHotkeyPressed("ctrl") || isHotkeyPressed("meta")) {
			handleSelectionChange({
				target: { checked: !selected },
			} as ChangeEvent<HTMLInputElement>);
		} else {
			// Single click behavior - could be used for preview, etc.
		}
	};

	// If processing, show skeleton
	if (isCurrentlyProcessing) {
		return <SkeletonCard imageName={memoizedImage?.name || "Processing..."} />;
	}

	// If no image data, show skeleton
	if (!memoizedImage) {
		return <SkeletonCard imageName="Loading..." />;
	}

	// Render the actual image card
	return (
		<motion.div
			className={`relative mb-4 max-w-[300px] rounded-lg bg-base-100 shadow-lg transition-all duration-200 ${
				selected ? "ring-2 ring-primary" : ""
			}`}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			onClick={handleClick}
			onContextMenu={handleContextMenu}
		>
			{/* Selection checkbox */}
			<input
				type="checkbox"
				className="checkbox-primary checkbox absolute left-2 top-2 z-10"
				checked={selected}
				onChange={handleSelectionChange}
				onClick={(e) => e.stopPropagation()}
			/>

			{/* Checkbox for other actions */}
			<input
				type="checkbox"
				className="checkbox-secondary checkbox absolute right-2 top-2 z-10"
				checked={isChecked}
				onChange={handleCheckboxChange}
				onClick={(e) => e.stopPropagation()}
			/>

			{/* Thumbnail */}
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

			{/* Image info */}
			<div className="p-3">
				<h3 className="truncate text-sm font-medium text-base-content">
					{memoizedImage.name}
				</h3>
				<p className="mt-1 text-xs text-base-content/70">
					{memoizedImage.dimensions.width} × {memoizedImage.dimensions.height}
				</p>
				<p className="text-xs text-base-content/70">
					{memoizedImage.metadata.format.toUpperCase()}
				</p>
			</div>
		</motion.div>
	);
}

export default EnhancedImageCard;
