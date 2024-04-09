import { useRef, useEffect, useState } from 'react';
import { playlistStore } from '../stores/playlist';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { imagesStore } from '../stores/images';
import { type playlistSelectType } from '../../electron/database/schema';
import { PLAYLIST_TYPES } from '../../shared/types/playlist';
import {
    type rendererPlaylist,
    type rendererImage
} from '../types/rendererTypes';
import { useMonitorStore } from '../stores/monitors';
import { IPC_MAIN_EVENTS } from '../../shared/constants';
interface Input {
    selectPlaylist: string;
}

interface Props {
    playlistsInDB: playlistSelectType[];
    currentPlaylistName: string;
    setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}

const {
    getPlaylistImages,
    startPlaylist,
    deletePlaylist,
    stopPlaylist,
    registerListener,
    updateTray
} = window.API_RENDERER;
let firstRender = true;
const LoadPlaylistModal = ({
    playlistsInDB,
    setShouldReload,
    currentPlaylistName
}: Props) => {
    const { clearPlaylist, setPlaylist } = playlistStore();
    const { imagesMap } = imagesStore();
    const [error, setError] = useState('');
    const { register, handleSubmit, watch } = useForm<Input>();
    const { activeMonitor } = useMonitorStore();
    const modalRef = useRef<HTMLDialogElement>(null);

    const closeModal = () => {
        modalRef.current?.close();
    };
    const onSubmit: SubmitHandler<Input> = async data => {
        clearPlaylist();
        const selectedPlaylist = playlistsInDB.find(playlist => {
            return playlist.name === data.selectPlaylist;
        });
        if (selectedPlaylist !== undefined) {
            const imagesArrayFromPlaylist = await getPlaylistImages(
                selectedPlaylist.id
            );
            const imagesToStorePlaylist: rendererImage[] = [];
            imagesArrayFromPlaylist.forEach(image => {
                const imageToStore = imagesMap.get(image.id);
                if (imageToStore === undefined) return;
                if (
                    selectedPlaylist.type === PLAYLIST_TYPES.timeofday &&
                    image.time !== null
                ) {
                    imageToStore.time = image.time;
                }
                imageToStore.isChecked = true;
                imagesToStorePlaylist.push(imageToStore);
            });
            const currentPlaylist: rendererPlaylist = {
                name: selectedPlaylist.name,
                configuration: {
                    type: selectedPlaylist.type,
                    order: selectedPlaylist.order,
                    interval: selectedPlaylist.interval,
                    showAnimations: selectedPlaylist.showAnimations,
                    alwaysStartOnFirstImage:
                        selectedPlaylist.alwaysStartOnFirstImage
                },
                images: imagesToStorePlaylist,
                activeMonitor
            };
            if (activeMonitor.monitors.length < 1) {
                setError(
                    'Select at least one display before setting a playlist'
                );
                setTimeout(() => {
                    setError('');
                }, 3000);
                return;
            }
            setPlaylist(currentPlaylist);
            startPlaylist({
                name: currentPlaylist.name,
                activeMonitor
            });
        }
        closeModal();
    };
    useEffect(() => {
        if (!firstRender) return;
        firstRender = false;
        registerListener({
            channel: IPC_MAIN_EVENTS.clearPlaylist,
            listener: _ => {
                clearPlaylist();
                updateTray();
            }
        });
    }, []);
    return (
        <dialog id="LoadPlaylistModal" className="modal" ref={modalRef}>
            <div className="modal-box container flex flex-col">
                <h2 className="font-bold text-4xl text-center py-3 ">
                    Load Playlist
                </h2>
                {error.length > 0 && (
                    <div role="alert" className="alert m-0 alert-error">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="stroke-current shrink-0 h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <div className="divider"></div>
                {playlistsInDB.length === 0 && (
                    <section className="flex flex-col gap-3">
                        <span className=" text-center font-medium text-xl italic">
                            No playlists found, refresh or create a new one
                        </span>
                        <button
                            type="button"
                            className="btn btn-block uppercase btn-active"
                            onClick={() => {
                                setShouldReload(true);
                            }}
                        >
                            Refresh playlists
                        </button>
                    </section>
                )}
                {playlistsInDB.length > 0 && (
                    <form
                        onSubmit={e => {
                            void handleSubmit(onSubmit)(e);
                        }}
                        className="form-control flex flex-col gap-5"
                    >
                        <label
                            htmlFor="selectPlaylist"
                            className="label text-lg "
                        >
                            Select Playlist
                        </label>

                        <div className="flex align-baseline gap-10">
                            <select
                                id="selectPlaylist"
                                className="select select-bordered rounded-md text-lg basis-[90%]"
                                defaultValue={playlistsInDB[0].name}
                                {...register('selectPlaylist', {
                                    required: true
                                })}
                            >
                                {playlistsInDB.map(playlist => (
                                    <option
                                        key={playlist.id}
                                        value={playlist.name}
                                    >
                                        {playlist.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-md uppercase btn-error rounded-md "
                                onClick={() => {
                                    const current = watch('selectPlaylist');
                                    const shouldDelete = window.confirm(
                                        `Are you sure to delete ${current}?`
                                    );
                                    if (shouldDelete) {
                                        deletePlaylist(current);
                                        setShouldReload(true);
                                        if (currentPlaylistName !== '') {
                                            stopPlaylist({
                                                name: currentPlaylistName,
                                                activeMonitor
                                            });
                                        }
                                        if (currentPlaylistName === current) {
                                            clearPlaylist();
                                        }
                                    }
                                }}
                            >
                                Delete
                            </button>
                        </div>
                        <div className="flex gap-3 justify-center mt-3">
                            <button
                                type="button"
                                className="btn uppercase btn-md rounded-md "
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-active btn-md uppercase rounded-md "
                            >
                                Load
                            </button>
                        </div>
                    </form>
                )}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default LoadPlaylistModal;
