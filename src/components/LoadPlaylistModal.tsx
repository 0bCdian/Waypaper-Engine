import { useRef, useEffect, useState } from "react";
import { playlistStore } from "../stores/playlist";
import { useForm, type SubmitHandler } from "react-hook-form";
import { imagesStore } from "../stores/images";
import { type playlistSelectType } from "../../database/schema";
import { PLAYLIST_TYPES } from "../../shared/types/playlist";
import {
    type rendererPlaylist,
    type rendererImage
} from "../types/rendererTypes";
import { useMonitorStore } from "../stores/monitors";
import { IPC_MAIN_EVENTS } from "../../shared/constants";
import { type ActiveMonitor } from "../../shared/types/monitor";
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
    const [error, setError] = useState("");
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
                    selectedPlaylist.type === PLAYLIST_TYPES.TIME_OF_DAY &&
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
                    "Select at least one display before setting a playlist"
                );
                setTimeout(() => {
                    setError("");
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
            listener: (
                _,
                playlist: { name: string; activeMonitor: ActiveMonitor }
            ) => {
                clearPlaylist(playlist);
                updateTray();
            }
        });
    }, []);
    return (
        <dialog id="LoadPlaylistModal" className="modal" ref={modalRef}>
            <div className="container modal-box flex flex-col">
                <h2 className="select-none py-3 text-center text-4xl font-bold">
                    Load Playlist
                </h2>
                {error.length > 0 && (
                    <div role="alert" className="alert alert-error m-0">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 shrink-0 stroke-current"
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
                        <span className="text-center text-xl font-medium italic">
                            No playlists found, refresh or create a new one
                        </span>
                        <button
                            type="button"
                            className="btn btn-active btn-block uppercase"
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
                            className="label text-lg"
                        >
                            Select Playlist
                        </label>

                        <div className="flex gap-10 align-baseline">
                            <select
                                id="selectPlaylist"
                                className="select select-bordered basis-[90%] rounded-md text-lg"
                                defaultValue={playlistsInDB[0].name}
                                {...register("selectPlaylist", {
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
                                className="btn btn-error btn-md rounded-md uppercase"
                                onClick={() => {
                                    const current = watch("selectPlaylist");
                                    const shouldDelete = window.confirm(
                                        `Are you sure to delete ${current}?`
                                    );
                                    if (shouldDelete) {
                                        deletePlaylist(current);
                                        setShouldReload(true);
                                        if (currentPlaylistName !== "") {
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
                        <div className="mt-3 flex justify-center gap-3">
                            <button
                                type="button"
                                className="btn btn-md rounded-md uppercase"
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-active btn-md rounded-md uppercase"
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
