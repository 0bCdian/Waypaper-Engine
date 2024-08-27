import { type ChangeEvent, useState, useEffect } from "react";
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
const { setImage, openContextMenu, getImageSrc, getThumbnailSrc } =
    window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    const [selected, setSelected] = useState(Image.isSelected);
    const [isChecked, setIsChecked] = useState(Image.isChecked);
    const imageNameFilePath = getThumbnailSrc(Image.name);
    const { activeMonitor } = useMonitorStore();
    const handleDoubleClick = () => {
        setImage(Image, activeMonitor);
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
            Image.isChecked = true;
            addImageToPlaylist([Image]);
        } else {
            Image.isChecked = false;
            setIsChecked(false);
            removeImageFromPlaylist(new Set<number>().add(Image.id));
        }
    };
    const handleRightClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openContextMenu({ Image, selectedImagesLength: selectedImages.size });
    };
    useEffect(() => {
        if (selected) addToSelectedImages(Image);
        else removeFromSelectedImages(Image);
    }, [selected]);
    useEffect(() => {
        if (imagesInPlaylist.has(Image.id) && !isEmpty) {
            setIsChecked(true);
            Image.isChecked = true;
            return;
        }
        setIsChecked(false);
        Image.isChecked = false;
    }, [isEmpty, imagesInPlaylist]);
    useEffect(() => {
        if (selectedImages.size === 0) {
            setSelected(false);
            return;
        }
        setSelected(selectedImages.has(Image.id));
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
                setSelected(prev => {
                    Image.isSelected = !prev;
                    return !prev;
                });
            }}
        >
            <div className="relative">
                <input
                    checked={isChecked}
                    id={Image.name}
                    onChange={handleCheckboxChange}
                    type="checkbox"
                    className="checkbox-success checkbox checkbox-sm absolute right-2 top-2 z-20 rounded-sm opacity-0 checked:opacity-100 group-hover:bg-success group-hover:opacity-100"
                />
            </div>
            <div onDoubleClick={handleDoubleClick}>
                <img
                    className="transform-gpu rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:object-center"
                    src={imageNameFilePath}
                    alt={Image.name}
                    draggable={false}
                    loading="lazy"
                    onError={({ currentTarget }) => {
                        currentTarget.onerror = null;
                        currentTarget.className =
                            "rounded-lg min-w-full max-w-[300px] object-fill";
                        currentTarget.src = getImageSrc(Image.name);
                    }}
                />
                <p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis bg-black bg-opacity-75 p-2 pl-2 text-justify text-lg font-medium opacity-0 transition-all duration-300 group-hover:opacity-100">
                    {Image.name}
                </p>
                <div
                    data-selected={Image.isSelected}
                    id="overlay"
                    className="absolute top-0 z-10 h-full w-full bg-blue-600 opacity-0 transition-all data-[selected=true]:opacity-45"
                ></div>
            </div>
        </motion.div>
    );
}

export default ImageCard;
