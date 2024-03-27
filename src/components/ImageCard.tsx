import { type ChangeEvent, useState, useEffect } from 'react';
import { playlistStore } from '../stores/playlist';
import { motion } from 'framer-motion';
import { type rendererImage } from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
import { useShallow } from 'zustand/react/shallow';
interface ImageCardProps {
    Image: rendererImage;
}
const { setImage, openContextMenu, getImageSrc, getThumbnailSrc } =
    window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    const [selected, setSelected] = useState(Image.isSelected);
    const [isChecked, setIsChecked] = useState(Image.isChecked);
    const css = `duration-500 border-[2px] ${Image.isSelected ? 'border-info' : 'border-transparent'}  group  relative rounded-lg bg-transparent max-w-fit my-1 overflow-hidden`;
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
    const { addSelectedImage, removeSelectedImage } = imagesStore();
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
        openContextMenu(Image);
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
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onContextMenu={handleRightClick}
            className={css}
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
                    data-selected={Image.isSelected}
                    className="rounded-lg transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300"
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
                    onClick={e => {
                        e.stopPropagation();
                        setSelected(prev => {
                            Image.isSelected = !prev;
                            return !prev;
                        });
                    }}
                />
                <p className="absolute opacity-0 group-hover:opacity-100 duration-300 transition-all bottom-0 pl-2 p-2 w-full text-lg text-justify text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium truncate ">
                    {Image.name}
                </p>
            </div>
        </motion.div>
    );
}

export default ImageCard;
