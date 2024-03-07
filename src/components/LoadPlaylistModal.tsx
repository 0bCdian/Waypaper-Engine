import { useRef } from 'react';
import { type Playlist } from '../../shared/types/playlist';
import { type Image } from '../../shared/types/image';
import playlistStore from '../hooks/playlistStore';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useImages } from '../hooks/imagesStore';

interface Input {
    selectPlaylist: string;
}

interface Props {
    playlistsInDB: Playlist[];
    currentPlaylistName: string;
    setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}

const {
    getPlaylistImages,
    startPlaylist,
    deletePlaylist,
    stopPlaylist,
    onClearPlaylist,
    updateTray
} = window.API_RENDERER;

const LoadPlaylistModal = ({
    playlistsInDB,
    setShouldReload,
    currentPlaylistName
}: Props) => {
    const { clearPlaylist, setPlaylist } = playlistStore();
    const { resetImageCheckboxes, imagesArray } = useImages();
    const { register, handleSubmit, watch } = useForm<Input>();
    const modalRef = useRef<HTMLDialogElement>(null);

    const closeModal = () => {
        modalRef.current?.close();
    };
    const onSubmit: SubmitHandler<Input> = async data => {
        resetImageCheckboxes();
        clearPlaylist();
        const selectedPlaylist = playlistsInDB.find(playlist => {
            return playlist.name === data.selectPlaylist;
        });
        if (selectedPlaylist !== undefined) {
            const imagesArrayFromPlaylist = await getPlaylistImages(
                selectedPlaylist.id
            );
            const imagesToStorePlaylist: Image[] = [];
            imagesArrayFromPlaylist.forEach(imageNameFromDB => {
                const imageToStore = imagesArray.find(imageInGallery => {
                    return imageInGallery.name === imageNameFromDB.name;
                });
                if (imageToStore === undefined) return;
                if (
                    selectedPlaylist.type === 'timeofday' &&
                    imageNameFromDB.time !== null
                ) {
                    imageToStore.time = imageNameFromDB.time;
                }
                imageToStore.isChecked = true;
                imagesToStorePlaylist.push(imageToStore);
            });
            const currentPlaylist = {
                name: selectedPlaylist.name,
                configuration: {
                    playlistType: selectedPlaylist.type,
                    order: selectedPlaylist.order,
                    interval: selectedPlaylist.interval,
                    showAnimations: selectedPlaylist.showAnimations
                },
                images: imagesToStorePlaylist
            };
            setPlaylist(currentPlaylist);
            startPlaylist(currentPlaylist.name);
        }
        closeModal();
    };
    onClearPlaylist(() => {
        updateTray();
        resetImageCheckboxes();
        clearPlaylist();
    });

    return (
        <dialog id="LoadPlaylistModal" className="modal" ref={modalRef}>
            <div className="modal-box container flex flex-col">
                <h2 className="font-bold text-4xl text-center py-3 ">
                    Load Playlist
                </h2>

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
                                        if (currentPlaylistName === current) {
                                            stopPlaylist();
                                            clearPlaylist();
                                            resetImageCheckboxes();
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
