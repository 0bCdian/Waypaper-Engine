import { useState, useId, type ChangeEvent } from 'react';
import playlistStore from '../stores/playlist';
import { motion } from 'framer-motion';
import { type rendererImage } from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
interface ImageCardProps {
    Image: rendererImage;
}
const { setImage, openContextMenu, getImageSrc, getThumbnailSrc } =
    window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    const id = useId();
    const [isSelected, setIsSelected] = useState(false);
    const css = `duration-500 border-[2px] ${isSelected ? 'border-info' : 'border-transparent'}  group  relative rounded-lg bg-transparent max-w-fit my-1 overflow-hidden`;
    const imageNameFilePath = getThumbnailSrc(Image.name);
    const handleDoubleClick = () => {
        setImage(Image.name);
    };
    const { addImageToPlaylist, removeImageFromPlaylist, readPlaylist } =
        playlistStore();
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
                element.checked = false;
                return;
            }
            Image.isChecked = true;
            addImageToPlaylist(Image);
        } else {
            Image.isChecked = false;
            removeImageFromPlaylist(Image);
        }
    };
    const handleRightClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openContextMenu(Image);
    };
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
                    checked={Image.isChecked}
                    id={id}
                    onChange={handleCheckboxChange}
                    type="checkbox"
                    className="absolute opacity-0 top-2 right-2 rounded-sm group-hover:opacity-100 checked:opacity-100  z-20 checkbox checkbox-sm checkbox-success group-hover:bg-success"
                />
            </div>
            <div onDoubleClick={handleDoubleClick}>
                <img
                    data-selected={isSelected}
                    className="rounded-lg data-[selected='true']:scale-110 transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300"
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
                        const newIsSelected = !isSelected;
                        if (newIsSelected) {
                            addSelectedImage(Image);
                        } else {
                            removeSelectedImage(Image);
                        }
                        setIsSelected(newIsSelected);
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
