import { type ChangeEvent, useState, useEffect, useMemo, useRef } from "react";
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
        [Image.id, Image.name, Image.selection?.isSelected, Image.selection?.isChecked]
    );

    const [selected, setSelected] = useState(memoizedImage.selection?.isSelected ?? false);
    const [isChecked, setIsChecked] = useState(
        memoizedImage.selection?.isChecked ?? false
    );
    const [imageSrc, setImageSrc] = useState<string>("");
    const { activeMonitor } = useMonitorStore();
    
    const imgRef = useRef<HTMLImageElement>(null);

    // Helper function to ensure selection property exists
    const ensureSelection = (image: rendererImage) => {
        if (!image.selection) {
            image.selection = {
                isChecked: false,
                isSelected: false,
                selectedAt: undefined,
                selectedPlaylists: []
            };
        }
        return image.selection;
    };

    // Load image path
    useEffect(() => {
        const loadImagePath = async () => {
            try {
                if (!memoizedImage.name || !memoizedImage.path) {
                    return;
                }
                setImageSrc(memoizedImage.path);
            } catch (error) {
                console.error("Failed to load image path:", error);
            }
        };

        loadImagePath();
    }, [memoizedImage.name, memoizedImage.path]);

    // Get thumbnail path from image data
    const getThumbnailSrc = () => {
        if (!memoizedImage.thumbnails) return "";
        
        const screenWidth = window.innerWidth;
        let thumbnailPath = "";
        
        if (screenWidth >= 2560) {
            thumbnailPath = memoizedImage.thumbnails["1440p"] || memoizedImage.thumbnails["1080p"] || memoizedImage.thumbnails["720p"];
        } else if (screenWidth >= 1920) {
            thumbnailPath = memoizedImage.thumbnails["1080p"] || memoizedImage.thumbnails["720p"];
        } else {
            thumbnailPath = memoizedImage.thumbnails["720p"];
        }
        
        return thumbnailPath || "";
    };

    const thumbnailSrc = getThumbnailSrc();
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
            goDaemon.setImageAcrossMonitors(memoizedImage.id, activeMonitor);
        } else {
            console.log("🟢 ImageCard: Using single monitor mode");
            console.log(
                "🟢 ImageCard: Calling goDaemon.setImage with:",
                memoizedImage.id,
                activeMonitor.name
            );
            goDaemon.setImage(memoizedImage.id, activeMonitor.name);
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
            ensureSelection(memoizedImage).isChecked = true;
            addImageToPlaylist([memoizedImage]);
        } else {
            ensureSelection(memoizedImage).isChecked = false;
            setIsChecked(false);
            removeImageFromPlaylist(new Set<number>().add(memoizedImage.id));
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
        if (imagesInPlaylist.has(memoizedImage.id) && !isEmpty) {
            setIsChecked(true);
            ensureSelection(memoizedImage).isChecked = true;
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
        setSelected(selectedImages.has(memoizedImage.id));
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
                    ensureSelection(memoizedImage).isSelected = !prev;
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
                    ref={imgRef}
                    className="transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center"
                    src={thumbnailSrc || imageSrc}
                    alt={memoizedImage.name}
                    draggable={false}
                    loading="lazy"
                    onError={({ currentTarget }) => {
                        currentTarget.onerror = null;
                        currentTarget.className =
                            "rounded-lg min-w-full max-w-[300px] object-fill";
                        currentTarget.src = imageSrc;
                    }}
                />
                <p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis bg-black bg-opacity-75 p-2 pl-2 text-justify text-lg font-medium opacity-0 transition-all duration-300 group-hover:opacity-100">
                    {memoizedImage.name}
                </p>
                <div
                    data-selected={memoizedImage.selection?.isSelected ?? false}
                    id="overlay"
                    className="absolute top-0 z-10 h-full w-full bg-blue-600 opacity-0 transition-all data-[selected=true]:opacity-45"
                ></div>
            </div>
        </motion.div>
    );
}

export default ImageCard;
