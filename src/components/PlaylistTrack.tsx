import { DndContext, type DragEndEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import { useMemo, useEffect, useRef } from 'react';
import MiniPlaylistCard from './MiniPlaylistCard';
import playlistStore from '../stores/playlist';
import openImagesStore from '../hooks/useOpenImages';
import { motion, AnimatePresence } from 'framer-motion';
import { imagesStore } from '../stores/images';
import { type openFileAction } from '../../shared/types';
import { type rendererImage } from '../types/rendererTypes';
function PlaylistTrack() {
    const {
        playlist,
        movePlaylistArrayOrder,
        addMultipleImagesToPlaylist,
        addImageToPlaylist,
        clearPlaylist,
        readPlaylist
    } = playlistStore();
    const { openImages, isActive } = openImagesStore();
    const { setSkeletons, addImages, resetImageCheckboxes, reQueryImages } =
        imagesStore();
    const handleDragEnd = (event: DragEndEvent) => {
        const { over, active } = event;
        if (over === null) return;
        if (over.id !== active.id) {
            const oldindex = playlist.images.findIndex(
                element => element.id === active.id
            );
            const newIndex = playlist.images.findIndex(
                element => element.id === over?.id
            );
            const oldImage = playlist.images[oldindex];
            const newImage = playlist.images[newIndex];
            const buffer = oldImage.time;
            oldImage.time = newImage.time;
            newImage.time = buffer;
            const newArrayOrder = arrayMove(
                playlist.images,
                oldindex,
                newIndex
            );
            movePlaylistArrayOrder(newArrayOrder);
        }
    };
    const handleClickAddImages = (action: openFileAction) => {
        void openImages({
            setSkeletons,
            addImages,
            addMultipleImagesToPlaylist,
            addImageToPlaylist,
            currentPlaylist: readPlaylist(),
            action
        });
    };
    const sortingCriteria: number[] = [];
    const reorderSortingCriteria = () => {
        // @ts-expect-error typescript not recognizing toSorted yet
        const newArray = playlist.images.toSorted(
            (a: rendererImage, b: rendererImage) => {
                if (a.time === null || b.time === null) return 0;
                if (a.time < b.time) {
                    return -1;
                }
                if (a.time > b.time) {
                    return 1;
                }
                return 0;
            }
        ) as rendererImage[];
        movePlaylistArrayOrder(newArray);
    };
    const playlistArray = useMemo(() => {
        const lastIndex = playlist.images.length - 1;
        const elements = playlist.images.map((Image, index) => {
            sortingCriteria.push(Image.id);
            return (
                <MiniPlaylistCard
                    isLast={lastIndex === index}
                    reorderSortingCriteria={reorderSortingCriteria}
                    playlistType={playlist.configuration.playlistType}
                    index={index}
                    Image={Image}
                    key={Image.id}
                />
            );
        });
        return elements;
    }, [playlist.images, playlist.configuration]);
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (playlist.images.length === 0) {
            resetImageCheckboxes();
            reQueryImages();
            clearPlaylist();
        }
    }, [playlist.images]);
    return (
        <div className="w-full flex flex-col gap-2 mb-2 mt-2">
            <div className="flex justify-between items-center mb-2">
                <div className="flex gap-5 items-center ">
                    <span className="text-4xl font-bold">
                        {playlistArray.length > 0
                            ? `Playlist (${playlistArray.length})`
                            : 'Playlist'}
                    </span>
                    <div className="dropdown dropdown-top">
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-primary uppercase rounded-lg m-1"
                        >
                            Add images
                        </div>
                        <ul
                            tabIndex={0}
                            className="dropdown-content mb-1 bg-base-100 z-[10] menu p-2 shadow  rounded-box w-52"
                        >
                            <li>
                                <a
                                    className="text-lg text-base-content"
                                    onClick={
                                        isActive
                                            ? undefined
                                            : () => {
                                                  handleClickAddImages('file');
                                              }
                                    }
                                >
                                    Individual images
                                </a>
                            </li>
                            <li>
                                <a
                                    className="text-lg text-base-content"
                                    onClick={
                                        isActive
                                            ? undefined
                                            : () => {
                                                  handleClickAddImages(
                                                      'folder'
                                                  );
                                              }
                                    }
                                >
                                    Image directory
                                </a>
                            </li>
                        </ul>
                    </div>
                    <button
                        onClick={() => {
                            // @ts-expect-error daisyui fix
                            window.LoadPlaylistModal.showModal();
                        }}
                        className="btn uppercase btn-primary rounded-lg"
                    >
                        Load Playlist
                    </button>

                    <AnimatePresence mode="sync">
                        {playlist.images.length > 1 && (
                            <>
                                <div
                                    className="tooltip tooltip-success"
                                    data-tip="Save Playlist"
                                >
                                    <motion.button
                                        initial={{ y: 100 }}
                                        transition={{
                                            duration: 0.25,
                                            ease: 'easeInOut'
                                        }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 100, opacity: 0 }}
                                        onClick={() => {
                                            // @ts-expect-error daisyui fix
                                            window.savePlaylistModal.showModal();
                                        }}
                                        className="btn uppercase btn-primary rounded-lg"
                                    >
                                        Save
                                    </motion.button>
                                </div>
                                <div
                                    className="tooltip tooltip-success"
                                    data-tip="Configure Playlist"
                                >
                                    <motion.button
                                        initial={{ y: 100 }}
                                        transition={{
                                            duration: 0.25,
                                            ease: 'easeInOut'
                                        }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 100, opacity: 0 }}
                                        onClick={() => {
                                            // @ts-expect-error daisyui fix
                                            window.playlistConfigurationModal.showModal();
                                        }}
                                        className="btn uppercase btn-primary rounded-lg"
                                    >
                                        Configure
                                    </motion.button>
                                </div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
                <AnimatePresence>
                    {playlist.images.length > 1 && (
                        <div
                            className="tooltip tooltip-success"
                            data-tip={`Clears and stops "${playlist.name}"`}
                        >
                            <motion.button
                                initial={{ y: 100, opacity: 0 }}
                                transition={{
                                    duration: 0.25,
                                    ease: 'easeInOut'
                                }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="btn uppercase btn-error rounded-lg"
                                onClick={() => {
                                    resetImageCheckboxes();
                                    clearPlaylist();
                                }}
                            >
                                Clear
                            </motion.button>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            <DndContext
                autoScroll={true}
                onDragEnd={handleDragEnd}
                collisionDetection={closestCorners}
            >
                <SortableContext items={sortingCriteria}>
                    <div className="flex rounded-lg  overflow-y-clip  max-w-[90vw] overflow-x-scroll scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar scrollbar-thumb-neutral-300">
                        {...playlistArray}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

export default PlaylistTrack;
