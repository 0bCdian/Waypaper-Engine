import { useState, useId, type ChangeEvent } from 'react';
import playlistStore from '../hooks/playlistStore';
import { type Image } from '../../shared/types/image';
import { motion } from 'framer-motion';
interface ImageCardProps {
    Image: Image;
}
const { join, thumbnailDirectory, setImage, imagesDirectory, openContextMenu } =
    window.API_RENDERER;
function ImageCard({ Image }: ImageCardProps) {
    const id = useId();
    const [isSelected, setIsSelected] = useState(false);
    const css = `duration-500 border-[2px] ${isSelected ? 'border-info' : 'border-transparent'}  group hover:border-info relative rounded-lg bg-transparent max-w-fit my-1 overflow-hidden`;
    const imageNameFilePath = `atom://${join(
        thumbnailDirectory,
        `${Image.name.split('.').at(0)}.webp`
    )}`;
    const handleDoubleClick = () => {
        setImage(Image.name);
    };
    const { addImageToPlaylist, removeImageFromPlaylist, readPlaylist } =
        playlistStore();
    const handleCheckboxChange = (event: ChangeEvent) => {
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
            onClick={() => {
                setIsSelected(prev => {
                    return !prev;
                });
            }}
            className={css}
        >
            <div className="relative">
                <input
                    id={id}
                    checked={Image.isChecked}
                    onChange={handleCheckboxChange}
                    type="checkbox"
                    className="absolute opacity-0 top-2 right-2 rounded-sm group-hover:opacity-100 checked:opacity-100  z-20 checkbox checkbox-sm checkbox-success group-hover:bg-success"
                />
            </div>
            <div onDoubleClick={handleDoubleClick}>
                <img
                    className="rounded-lg transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300"
                    src={imageNameFilePath}
                    alt={Image.name}
                    draggable={false}
                    loading="lazy"
                    onError={({ currentTarget }) => {
                        currentTarget.onerror = null;
                        currentTarget.className =
                            'rounded-lg min-w-full max-w-[300px] object-fill';
                        currentTarget.src =
                            'atom://' + join(imagesDirectory, Image.name);
                    }}
                />
                <p className="absolute rounded-b-lg opacity-0 group-hover:opacity-100 duration-300 transition-all bottom-0 pl-2 p-2 w-full text-lg text-justify text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium truncate ">
                    {Image.name}
                </p>
            </div>
        </motion.div>
    );
}

export default ImageCard;
