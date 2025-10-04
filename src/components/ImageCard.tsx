import { type ChangeEvent, useState, useEffect, useMemo } from "react";
import { playlistStore } from "../stores/playlist";
import { motion } from "framer-motion";
import { type rendererImage } from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { isHotkeyPressed } from "react-hotkeys-hook";
import { useMonitorStore } from "../stores/monitors";
interface ImageCardProps {
    Image: rendererImage;
}
const { goDaemon } = window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    // Memoize the image object to prevent unnecessary re-renders
    const memoizedImage = useMemo(
        () => Image,
        [Image.id, Image.name, Image.selection.isSelected, Image.selection.isChecked]
    );

    const [selected, setSelected] = useState(memoizedImage.selection.isSelected);
    const [isChecked, setIsChecked] = useState(
        memoizedImage.selection.isChecked ?? false
    );
    const [imageNameFilePath, setImageNameFilePath] = useState<string>("");
    const [imageSrc, setImageSrc] = useState<string>("");
    const [isThumbnailLoading, setIsThumbnailLoading] = useState<boolean>(false);
    const { activeMonitor } = useMonitorStore();

    // Load thumbnail and image paths asynchronously
    useEffect(() => {
        // Only load paths if we don't already have them
        if (imageNameFilePath && imageSrc) {
            return;
        }

        const loadPaths = async () => {
            try {
                console.log(
                    "🟢 ImageCard: Loading paths for image:",
                    memoizedImage.name,
                    "Type:",
                    typeof memoizedImage.name
                );
                if (!memoizedImage.name) {
                    console.error(
                        "🔴 ImageCard: Image has no name!",
                        memoizedImage
                    );
                    return;
                }
                // Check if thumbnail exists in image data first
                let thumbnailPath = "";
                const screenWidth = window.innerWidth;

                if (memoizedImage.thumbnails) {
                    // Use thumbnail paths from the image if available
                    if (screenWidth >= 3840) {
                        thumbnailPath =
                            memoizedImage.thumbnails["4k"] ||
                            memoizedImage.thumbnails.fallback;
                    } else if (screenWidth >= 2560) {
                        thumbnailPath =
                            memoizedImage.thumbnails["1440p"] ||
                            memoizedImage.thumbnails.fallback;
                    } else if (screenWidth >= 1920) {
                        thumbnailPath =
                            memoizedImage.thumbnails["1080p"] ||
                            memoizedImage.thumbnails.fallback;
                    } else if (screenWidth >= 1280) {
                        thumbnailPath =
                            memoizedImage.thumbnails["720p"] ||
                            memoizedImage.thumbnails.fallback;
                    } else {
                        thumbnailPath = memoizedImage.thumbnails.fallback;
                    }

                    if (thumbnailPath) {
                        thumbnailPath = `atom://${thumbnailPath}`;
                    }
                }

                // If no thumbnail path from image data, request thumbnail creation
                if (!thumbnailPath || thumbnailPath === "atom://") {
                    console.log(
                        "🔵 ImageCard: Requesting thumbnail creation for:",
                        memoizedImage.name
                    );
                    setIsThumbnailLoading(true);
                    await goDaemon.createThumbnail(
                        [memoizedImage.path],
                        [memoizedImage.name]
                    );
                    // Thumbnail will be created in background, event will update the UI
                }
                const imagePath = await goDaemon.getImageSrc(
                    memoizedImage.name
                );
                console.log(
                    "🟢 ImageCard: Thumbnail path:",
                    thumbnailPath,
                    "Image path:",
                    imagePath
                );

                // Electron now provides ready-to-use atom:// URLs
                if (thumbnailPath && typeof thumbnailPath === "string") {
                    setImageNameFilePath(thumbnailPath);
                } else {
                    console.error(
                        "🔴 ImageCard: Invalid thumbnail path:",
                        thumbnailPath
                    );
                    setImageNameFilePath("");
                }

                if (imagePath && typeof imagePath === "string") {
                    setImageSrc(imagePath);
                } else {
                    console.error(
                        "🔴 ImageCard: Invalid image path:",
                        imagePath
                    );
                    setImageSrc("");
                }
            } catch (error) {
                console.error("Failed to load image paths:", error);
            }
        };
        loadPaths();

        // Listen for thumbnail_created events
        const handleThumbnailCreated = (eventData: any) => {
            if (eventData.imageName === memoizedImage.name) {
                console.log(
                    "🎉 ImageCard: Thumbnail created for:",
                    memoizedImage.name,
                    eventData
                );
                // Get the appropriate thumbnail path based on screen size
                const screenWidth = window.innerWidth;
                let thumbnailPath = "";

                if (screenWidth >= 3840) {
                    thumbnailPath =
                        eventData.thumbnails["4k"] ||
                        eventData.thumbnails.fallback;
                } else if (screenWidth >= 2560) {
                    thumbnailPath =
                        eventData.thumbnails["1440p"] ||
                        eventData.thumbnails.fallback;
                } else if (screenWidth >= 1920) {
                    thumbnailPath =
                        eventData.thumbnails["1080p"] ||
                        eventData.thumbnails.fallback;
                } else if (screenWidth >= 1280) {
                    thumbnailPath =
                        eventData.thumbnails["720p"] ||
                        eventData.thumbnails.fallback;
                } else {
                    thumbnailPath = eventData.thumbnails.fallback;
                }

                if (thumbnailPath) {
                    setImageNameFilePath(`atom://${thumbnailPath}`);
                    setIsThumbnailLoading(false);
                    // Force a re-render by updating the image state
                    console.log("🎉 ImageCard: Updated thumbnail path:", `atom://${thumbnailPath}`);
                }
            }
        };

        goDaemon.on("thumbnail_created", handleThumbnailCreated);

        // Cleanup listener on unmount
        return () => {
            goDaemon.off("thumbnail_created", handleThumbnailCreated);
        };
    }, [memoizedImage.name, imageNameFilePath, imageSrc]);
    const handleDoubleClick = () => {
        console.log(
            "🟢 ImageCard: handleDoubleClick called with Image:",
            memoizedImage
        );
        console.log(
            "🟢 ImageCard: Image.id:",
            memoizedImage.id,
            "Type:",
            typeof memoizedImage.id
        );
        console.log("🟢 ImageCard: activeMonitor:", activeMonitor);

        if (!memoizedImage.id) {
            console.error(
                "🔴 ImageCard: Cannot set image - Image.id is undefined",
                memoizedImage
            );
            return;
        }
        if (!activeMonitor?.name) {
            console.error(
                "🔴 ImageCard: Cannot set image - activeMonitor.name is undefined",
                activeMonitor
            );
            return;
        }

        // Check if we should use multi-monitor functionality
        if (
            activeMonitor.extendAcrossMonitors &&
            activeMonitor.monitors &&
            activeMonitor.monitors.length > 1
        ) {
            console.log(
                "🟢 ImageCard: Using multi-monitor stretch mode with monitors:",
                activeMonitor.monitors.length
            );
            console.log(
                "🟢 ImageCard: Calling goDaemon.setImageAcrossMonitors with:",
                memoizedImage.id,
                activeMonitor
            );
            goDaemon.setImageAcrossMonitors(parseInt(memoizedImage.id), activeMonitor);
        } else {
            console.log("🟢 ImageCard: Using single monitor mode");
            console.log(
                "🟢 ImageCard: Calling goDaemon.setImage with:",
                memoizedImage.id,
                activeMonitor.name
            );
            goDaemon.setImage(parseInt(memoizedImage.id), activeMonitor.name);
        }
    };
    const addImageToPlaylist = playlistStore(
        useShallow(state => state.addImagesToPlaylist)
    );
    const readPlaylist = playlistStore(useShallow(state => state.readPlaylist));
    const removeImageFromPlaylist = playlistStore(
        useShallow(state => state.removeImagesFromPlaylist)
    );
    const isEmpty = playlistStore(useShallow(state => state.isEmpty));
    const imagesInPlaylist = playlistStore(
        useShallow(state => state.playlistImagesSet)
    );
    const { addToSelectedImages, removeFromSelectedImages, selectedImages } =
        imagesStore();
    const handleCheckboxChange = (event: ChangeEvent) => {
        event.stopPropagation();
        const element = event.target as HTMLInputElement;
        if (element.checked) {
            const playlist = readPlaylist();
            if (
                playlist.configuration.type === "dayofweek" &&
                playlist.images.length === 7
            ) {
                setIsChecked(false);
                element.checked = false;
                return;
            }
            setIsChecked(true);
            memoizedImage.selection.isChecked = true;
            addImageToPlaylist([memoizedImage]);
        } else {
            memoizedImage.selection.isChecked = false;
            setIsChecked(false);
            removeImageFromPlaylist(new Set<number>().add(parseInt(memoizedImage.id)));
        }
    };
    const handleRightClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        goDaemon.openContextMenu({
            Image: memoizedImage,
            selectedImagesLength: selectedImages.size
        });
    };
    useEffect(() => {
        if (selected) addToSelectedImages(memoizedImage);
        else removeFromSelectedImages(memoizedImage);
    }, [selected]);
    useEffect(() => {
        if (imagesInPlaylist.has(parseInt(memoizedImage.id)) && !isEmpty) {
            setIsChecked(true);
            memoizedImage.selection.isChecked = true;
            return;
        }
        setIsChecked(false);
        memoizedImage.selection.isChecked = false;
    }, [isEmpty, imagesInPlaylist]);
    useEffect(() => {
        if (selectedImages.size === 0) {
            setSelected(false);
            return;
        }
        setSelected(selectedImages.has(parseInt(memoizedImage.id)));
    }, [selectedImages.size]);
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onContextMenu={handleRightClick}
            className="group relative my-1 max-w-fit overflow-hidden rounded-lg duration-200"
            onClick={e => {
                e.stopPropagation();
                if (!isHotkeyPressed("ctrl")) return;
                setSelected((prev: boolean) => {
                    memoizedImage.selection.isSelected = !prev;
                    return !prev;
                });
            }}
        >
            <div className="relative">
                <input
                    checked={isChecked}
                    id={memoizedImage.name}
                    onChange={handleCheckboxChange}
                    type="checkbox"
                    className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-sm opacity-0 checked:opacity-100 group-hover:bg-success group-hover:opacity-100"
                />
            </div>
            <div onDoubleClick={handleDoubleClick}>
                <img
                    className="transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center"
                    src={imageNameFilePath}
                    alt={memoizedImage.name}
                    draggable={false}
                    loading="lazy"
                    onError={({ currentTarget }) => {
                        currentTarget.onerror = null;
                        currentTarget.className =
                            "rounded-lg min-w-full max-w-[300px] object-fill";
                        currentTarget.src = imageSrc;
                        
                        // Trigger thumbnail recreation for broken thumbnail
                        console.log("🔴 ImageCard: Thumbnail failed to load, requesting recreation for:", memoizedImage.name);
                        setIsThumbnailLoading(true);
                        goDaemon.createThumbnail([memoizedImage.path], [memoizedImage.name])
                            .catch((err: any) => {
                                console.error("Failed to request thumbnail recreation:", err);
                                setIsThumbnailLoading(false);
                            });
                    }}
                />
                <p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis bg-black bg-opacity-75 p-2 pl-2 text-justify text-lg font-medium opacity-0 transition-all duration-300 group-hover:opacity-100">
                    {memoizedImage.name}
                </p>
                <div
                    data-selected={memoizedImage.selection.isSelected}
                    id="overlay"
                    className="absolute top-0 z-10 h-full w-full bg-blue-600 opacity-0 transition-all data-[selected=true]:opacity-45"
                ></div>
                {isThumbnailLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                        <div className="flex flex-col items-center space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            <span className="text-white text-sm">Creating thumbnail...</span>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default ImageCard;
