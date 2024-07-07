import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { playlistStore } from "../stores/playlist";
import { type rendererImage } from "../types/rendererTypes";
import { useMonitorStore } from "../stores/monitors";
const { savePlaylist } = window.API_RENDERER;

interface Props {
    currentPlaylistName: string;
    setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}
interface savePlaylistModalFields {
    playlistName: string;
}
const SavePlaylistModal = ({ currentPlaylistName, setShouldReload }: Props) => {
    const { setName, readPlaylist } = playlistStore();
    const [error, showError] = useState({ state: false, message: "" });
    const { activeMonitor } = useMonitorStore();
    const modalRef = useRef<HTMLDialogElement>(null);
    const { register, handleSubmit, setValue } =
        useForm<savePlaylistModalFields>();
    const closeModal = () => {
        modalRef.current?.close();
    };
    const checkDuplicateTimes = (Images: rendererImage[]) => {
        let duplicatesExist = false;
        const maxImageIndex = Images.length;
        // impossible value to get from the input time in miniplaylist card
        let lastTime = -1;
        for (let current = 0; current < maxImageIndex; current++) {
            if (Images[current].time === lastTime) {
                duplicatesExist = true;
            } else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                lastTime = Images[current].time!;
            }
        }
        return duplicatesExist;
    };
    const onSubmit: SubmitHandler<savePlaylistModalFields> = data => {
        setName(data.playlistName);
        const playlist = readPlaylist();
        if (playlist.configuration.type === "timeofday") {
            if (checkDuplicateTimes(playlist.images)) {
                showError({
                    state: true,
                    message:
                        "There are duplicate times in images, check them before resubmitting."
                });
                return;
            } else {
                showError({ state: false, message: "" });
            }
        }
        if (activeMonitor.monitors.length < 1 || activeMonitor.name === "") {
            showError({
                state: true,
                message: "Select at least one monitor to save playlist."
            });
            setTimeout(() => {
                showError({ state: false, message: "" });
            }, 3000);
            return;
        }
        playlist.activeMonitor = activeMonitor;
        savePlaylist(playlist);
        setShouldReload(true);
        closeModal();
    };
    useEffect(() => {
        setValue("playlistName", currentPlaylistName);
    }, [currentPlaylistName]);
    return (
        <dialog
            id="savePlaylistModal"
            className="modal select-none"
            draggable={false}
            ref={modalRef}
        >
            <form
                onSubmit={e => {
                    void handleSubmit(onSubmit)(e);
                }}
                className="modal-box form-control rounded-xl"
            >
                <h2 className="font-bold text-4xl text-center py-3 ">
                    Save Playlist
                </h2>
                <div className="divider"></div>
                <label
                    htmlFor="playlistName"
                    className="label text-warning italic"
                >
                    Playlists with the same name will be overwritten.
                </label>

                <input
                    type="text"
                    {...register("playlistName", { required: true })}
                    id="playlistName"
                    required
                    draggable={false}
                    className="input input-md rounded-md input-bordered mb-3 text-lg "
                    placeholder="Playlist Name"
                />
                <div className="divider"></div>
                {error.state && (
                    <label
                        htmlFor="playlistName"
                        className="label text-lg text-error italic"
                    >
                        {error.message}
                    </label>
                )}
                <button
                    type="submit"
                    className="btn btn-active uppercase rounded-lg"
                >
                    Save
                </button>
            </form>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default SavePlaylistModal;
