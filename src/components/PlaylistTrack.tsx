import { DndContext, type DragEndEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import { useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { playlistStore } from '../stores/playlist';
import { IPC_MAIN_EVENTS } from '../../shared/constants';
import openImagesStore from '../hooks/useOpenImages';
import { motion, AnimatePresence } from 'framer-motion';
import { imagesStore } from '../stores/images';
import { useMonitorStore } from '../stores/monitors';
import { type openFileAction } from '../../shared/types';
import {
    type rendererPlaylist,
    type rendererImage
} from '../types/rendererTypes';
import { useSetLastActivePlaylist } from '../hooks/useSetLastActivePlaylist';
import { PLAYLIST_TYPES } from '../../shared/types/playlist';
let firstRender = true;
const {
    stopPlaylist,
    setRandomImage,
    registerListener,
    deletePlaylist,
    readActivePlaylist
} = window.API_RENDERER;
const MiniPlaylistCard = lazy(async () => await import('./MiniPlaylistCard'));
function PlaylistTrack() {
    const {
        playlist,
        lastAddedImageID,
        movePlaylistArrayOrder,
        addImagesToPlaylist,
        clearPlaylist,
        setPlaylist,
        setEmptyPlaylist
    } = playlistStore();
    const { activeMonitor } = useMonitorStore();
    const { openImages, isActive } = openImagesStore();
    const { setSkeletons, addImages, imagesArray } = imagesStore();
    useSetLastActivePlaylist();

    const handleClickAddImages = useCallback((action: openFileAction) => {
        void openImages({
            setSkeletons,
            addImages,
            addImagesToPlaylist,
            action
        });
    }, []);
    const reorderSortingCriteria = useCallback(() => {
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
        );
        movePlaylistArrayOrder(newArray);
    }, [playlist]);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
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
                if (playlist.configuration.type === 'timeofday') {
                    reorderSortingCriteria();
                    return;
                }
                movePlaylistArrayOrder(newArrayOrder);
            }
        },
        [playlist]
    );

    const [playlistArray, sortingCriteria] = useMemo(() => {
        const lastIndex = playlist.images.length - 1;
        const sortingCriteria: number[] = [];
        const elements = playlist.images.map((Image, index) => {
            const isLast =
                playlist.configuration.type === 'timeofday'
                    ? lastAddedImageID === Image.id
                    : index === lastIndex;
            sortingCriteria.push(Image.id);
            return (
                <Suspense key={Image.id}>
                    <MiniPlaylistCard
                        isLast={isLast}
                        reorderSortingCriteria={reorderSortingCriteria}
                        type={playlist.configuration.type}
                        index={index}
                        Image={Image}
                    />
                </Suspense>
            );
        });
        return [elements, sortingCriteria];
    }, [playlist]);
    const updatePlaylist = () => {
        void readActivePlaylist(activeMonitor).then(playlistFromDB => {
            if (playlistFromDB === undefined) {
                setEmptyPlaylist();
                return;
            }

            if (playlistFromDB.images.length < 1) {
                deletePlaylist(playlistFromDB.name);
                return;
            }

            const imagesToStorePlaylist: rendererImage[] = [];
            playlistFromDB.images.forEach(imageInActivePlaylist => {
                const imageToCheck = imagesArray.find(imageInGallery => {
                    return imageInGallery.name === imageInActivePlaylist.name;
                });
                if (imageToCheck === undefined) {
                    return;
                }
                if (
                    playlistFromDB.type === PLAYLIST_TYPES.TIME_OF_DAY &&
                    imageInActivePlaylist.time !== null
                ) {
                    imageToCheck.time = imageInActivePlaylist.time;
                }
                imageToCheck.isChecked = true;
                imagesToStorePlaylist.push(imageToCheck);
            });
            const currentPlaylist: rendererPlaylist = {
                name: playlistFromDB.name,
                configuration: {
                    type: playlistFromDB.type,
                    order: playlistFromDB.order,
                    interval: playlistFromDB.interval,
                    showAnimations: playlistFromDB.showAnimations,
                    alwaysStartOnFirstImage:
                        playlistFromDB.alwaysStartOnFirstImage
                },
                images: imagesToStorePlaylist,
                activeMonitor
            };
            setPlaylist(currentPlaylist);
        });
    };
    useEffect(() => {
        if (firstRender) {
            firstRender = false;
            return;
        }
        if (playlist.images.length === 0) {
            clearPlaylist();
        }
    }, [playlist.images]);
    useEffect(() => {
        registerListener({
            channel: IPC_MAIN_EVENTS.requeryPlaylist,
            listener: _ => {
                updatePlaylist();
            }
        });
    }, [activeMonitor, imagesArray]);
    useEffect(() => {
        if (playlist.configuration.type === 'timeofday') {
            reorderSortingCriteria();
        }
    }, [playlist.images.length, playlist.configuration.type]);

    return (
        <div className="w-full flex flex-col gap-5 mb-2">
            <div className="xl:flex grid grid-cols-3 sm:flex-row gap-5 items-center">
                <span className="text-4xl font-bold col-span-3">
                    {playlistArray.length > 0
                        ? `Playlist (${playlistArray.length})`
                        : 'Playlist'}
                </span>
                <div className="dropdown dropdown-top">
                    <button
                        tabIndex={0}
                        role="button"
                        className="btn btn-primary uppercase rounded-lg w-full"
                    >
                        Add images
                    </button>
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
                                              handleClickAddImages('folder');
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
                <button
                    onClick={() => {
                        setRandomImage();
                    }}
                    className="btn uppercase btn-primary rounded-lg"
                >
                    Random Image
                </button>

                <AnimatePresence mode="sync">
                    {playlist.images.length > 1 && (
                        <>
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
                        </>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {playlist.images.length > 1 && (
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
                                if (playlist.name !== '') {
                                    stopPlaylist({
                                        name: playlist.name,
                                        activeMonitor: playlist.activeMonitor
                                    });
                                }
                                clearPlaylist();
                            }}
                        >
                            Clear
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
            <DndContext
                autoScroll={true}
                onDragEnd={handleDragEnd}
                collisionDetection={closestCorners}
            >
                <SortableContext items={sortingCriteria}>
                    <div className="flex rounded-lg overflow-y-hidden  sm:max-w-[90vw] overflow-x-scroll scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar scrollbar-thumb-neutral-300">
                        <AnimatePresence>{...playlistArray}</AnimatePresence>
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

export default PlaylistTrack;
