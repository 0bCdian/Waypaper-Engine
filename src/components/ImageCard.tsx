import { type ChangeEvent, useState, useEffect } from 'react';
import { playlistStore } from '../stores/playlist';
import { motion } from 'framer-motion';
import { type rendererImage } from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
import { useShallow } from 'zustand/react/shallow';
import { isHotkeyPressed } from 'react-hotkeys-hook';
interface ImageCardProps {
    Image: rendererImage;
}
const { setImage, openContextMenu, getImageSrc, getThumbnailSrc } =
    window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    const [selected, setSelected] = useState(Image.isSelected);
    const [isChecked, setIsChecked] = useState(Image.isChecked);
    const imageNameFilePath = getThumbnailSrc(Image.name);
    const handleDoubleClick = () => {
        setImage(Image.name);
    };
    const addImageToPlaylist = playlistStore(
        useShallow(state => state.addImageToPlaylist)
    );
    const readPlaylist = playlistStore(useShallow(state => state.readPlaylist));
    const removeImageFromPlaylist = playlistStore(
        useShallow(state => state.removeImageFromPlaylist)
    );
    const isEmpty = playlistStore(useShallow(state => state.isEmpty));
    const { addSelectedImage, removeSelectedImage, selectedImages } =
        imagesStore();
    const handleCheckboxChange = (event: ChangeEvent) => {
        event.stopPropagation();
        const element = event.target as HTMLInputElement;
        if (element.checked) {
            const playlist = readPlaylist();
            if (
                playlist.configuration.playlistType === 'dayofweek' &&
                playlist.images.length === 7
            ) {
                setIsChecked(false);
                element.checked = false;
                return;
            }
            setIsChecked(true);
            Image.isChecked = true;
            addImageToPlaylist(Image);
        } else {
            Image.isChecked = false;
            setIsChecked(false);
            removeImageFromPlaylist(Image);
        }
    };
    const handleRightClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openContextMenu({ Image, selectedImagesLength: selectedImages.size });
    };
    useEffect(() => {
        if (selected) addSelectedImage(Image);
        else removeSelectedImage(Image);
    }, [selected]);
    useEffect(() => {
        if (!isEmpty) return;
        setIsChecked(false);
        Image.isChecked = false;
    }, [isEmpty]);
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
            className="duration-200 group relative rounded-lg max-w-fit my-1 overflow-hidden"
            onClick={e => {
                e.stopPropagation();
                if (!isHotkeyPressed('ctrl')) return;
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
                    className="absolute opacity-0 top-2 right-2 rounded-sm group-hover:opacity-100 checked:opacity-100  z-20 checkbox checkbox-sm checkbox-success group-hover:bg-success"
                />
            </div>
            <div onDoubleClick={handleDoubleClick}>
                <img
                    className="rounded-lg  transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300"
                    src={imageNameFilePath}
                    alt={Image.name}
                    draggable={false}
                    loading="lazy"
                    onError={({ currentTarget }) => {
                        currentTarget.onerror = null;
                        currentTarget.className =
                            'rounded-lg min-w-full max-w-[300px] object-fill';
                        currentTarget.src = getImageSrc(Image.name);
                    }}
                />
                <p className="absolute opacity-0 group-hover:opacity-100 duration-300 transition-all bottom-0 pl-2 p-2 w-full text-lg text-justify text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium truncate ">
                    {Image.name}
                </p>
                <div
                    data-selected={Image.isSelected}
                    id="overlay"
                    className="absolute h-full top-0 w-full bg-blue-600 z-10 opacity-0 data-[selected=true]:opacity-45 transition-all "
                ></div>
            </div>
        </motion.div>
    );
}

export default ImageCard;
