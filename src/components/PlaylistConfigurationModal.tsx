import { useForm, type SubmitHandler } from "react-hook-form";
import { useRef, useEffect, useState } from "react";
import { playlistStore } from "../stores/playlist";
import {
    type PLAYLIST_TYPES_TYPE,
    type PLAYLIST_ORDER_TYPES,
    PLAYLIST_TYPES,
    PLAYLIST_ORDER
} from "../../shared/types/playlist";
import { toMS, toHoursAndMinutes } from "../utils/utilities";
interface Inputs {
    type: PLAYLIST_TYPES_TYPE;
    order: PLAYLIST_ORDER_TYPES | null;
    hours: string | null;
    minutes: string | null;
    showTransition: boolean;
    alwaysStartOnFirstImage: boolean;
}

const PlaylistConfigurationModal = () => {
    const [showError, setShowError] = useState(false);
    const { setConfiguration, playlist } = playlistStore();
    const { register, handleSubmit, watch, setValue } = useForm<Inputs>();
    const containerRef = useRef<HTMLDialogElement>(null);
    const closeModal = () => {
        containerRef.current?.close();
    };
    const classNameDisabled =
        playlist.images.length > 7 ? "bg-red-900 text-stone-100" : "";
    const onSubmit: SubmitHandler<Inputs> = data => {
        switch (data.type) {
            case "timer":
                if (data.hours === null || data.minutes === null) {
                    logger.error("Hours and minutes are required");
                } else {
                    const interval = toMS(
                        parseInt(data.hours),
                        parseInt(data.minutes)
                    );
                    const configuration = {
                        type: data.type,
                        order: data.order,
                        showAnimations: data.showTransition,
                        alwaysStartOnFirstImage: data.alwaysStartOnFirstImage,
                        interval
                    };
                    setConfiguration(configuration);
                }
                break;
            case "timeofday":
                setConfiguration({
                    type: data.type,
                    order: null,
                    showAnimations: data.showTransition,
                    interval: null,
                    alwaysStartOnFirstImage: false
                });
                break;
            case "dayofweek":
                if (playlist.images.length > 7) {
                    setShowError(prevState => !prevState);
                    setTimeout(() => {
                        setShowError(prevState => !prevState);
                    }, 5000);
                    return;
                }
                setConfiguration({
                    type: data.type,
                    order: null,
                    showAnimations: data.showTransition,
                    interval: null,
                    alwaysStartOnFirstImage: false
                });
                break;
            case "never":
                setConfiguration({
                    type: data.type,
                    order: data.order,
                    showAnimations: data.showTransition,
                    interval: null,
                    alwaysStartOnFirstImage: data.alwaysStartOnFirstImage
                });
                break;
            default:
                logger.error("Invalid playlist type");
        }
        closeModal();
    };
    const hours = watch("hours");
    const minutes = watch("minutes");
    useEffect(() => {
        if (hours === null || minutes === null) return;
        const parsedHours = parseInt(hours);
        const parsedMinutes = parseInt(minutes);
        if (parsedMinutes === 60) {
            setValue("hours", (parsedHours + 1).toString());
            setValue("minutes", "0");
        }
        if (parsedMinutes === 0 && parsedHours === 0) {
            setValue("minutes", "1");
        }
    }, [hours, minutes]);
    useEffect(() => {
        const interval = playlist.configuration.interval;
        if (interval !== null) {
            const { hours, minutes } = toHoursAndMinutes(interval);
            setValue("hours", hours.toString());
            setValue("minutes", minutes.toString());
        }
        setValue("type", playlist.configuration.type);
        setValue("order", playlist.configuration.order);
        setValue("showTransition", playlist.configuration.showAnimations);
        setValue(
            "alwaysStartOnFirstImage",
            playlist.configuration.alwaysStartOnFirstImage
        );
    }, [playlist]);
    return (
        <dialog
            id="playlistConfigurationModal"
            ref={containerRef}
            className="modal select-none"
            draggable={false}
        >
            <form
                className="form-control modal-box rounded-xl"
                onSubmit={e => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <h2 className="select-none text-center text-4xl font-bold">
                    Playlist Settings
                </h2>
                {showError && (
                    <div className="alert alert-error mt-5">
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
                        <span>
                            Weekly playlists cannot have more than 7 images.
                        </span>
                    </div>
                )}
                <div className="divider"></div>
                <div className="flex items-baseline justify-between">
                    <label
                        htmlFor="type"
                        className="label shrink text-3xl font-semibold"
                    >
                        Change wallpaper
                    </label>
                    <select
                        id="type"
                        className="select select-bordered w-2/5 cursor-default rounded-lg text-lg"
                        defaultValue={"timer"}
                        {...register("type", { required: true })}
                    >
                        <option value={PLAYLIST_TYPES.TIMER}>On a timer</option>
                        <option value={PLAYLIST_TYPES.TIME_OF_DAY}>
                            Time of day
                        </option>
                        <option
                            disabled={playlist.images.length > 7}
                            className={classNameDisabled}
                            value={PLAYLIST_TYPES.DAY_OF_WEEK}
                        >
                            Day of week
                        </option>
                        <option value={PLAYLIST_TYPES.NEVER}>Never</option>
                    </select>
                </div>
                {watch("type") === PLAYLIST_TYPES.TIMER && (
                    <div className="flex items-baseline justify-end gap-1">
                        <div className="flex w-1/5 flex-col">
                            <label
                                htmlFor="hours"
                                className="label text-lg font-medium"
                            >
                                Hours
                            </label>
                            <input
                                id="hours"
                                min="0"
                                defaultValue={1}
                                type="number"
                                {...register("hours", {
                                    required: true,
                                    min: 0
                                })}
                                className="input input-sm input-bordered select-none rounded-lg text-lg font-medium focus:outline-none"
                            />
                        </div>
                        <div className="flex w-1/5 flex-col">
                            <label
                                className="label rounded-lg text-lg font-medium"
                                htmlFor="minutes"
                            >
                                Minutes
                            </label>
                            <input
                                id="minutes"
                                defaultValue={0}
                                min="0"
                                max="60"
                                type="number"
                                step={1}
                                {...register("minutes", {
                                    required: true
                                })}
                                className="input input-sm input-bordered select-none rounded-lg text-lg font-medium focus:outline-none"
                            />
                        </div>
                    </div>
                )}
                {watch("type") !== PLAYLIST_TYPES.TIME_OF_DAY &&
                    watch("type") !== PLAYLIST_TYPES.DAY_OF_WEEK && (
                        <>
                            <div className="divider"></div>
                            <div className="flex items-baseline justify-between">
                                <label
                                    htmlFor="order"
                                    className="label text-3xl font-semibold"
                                >
                                    Order
                                </label>
                                <select
                                    className="select select-bordered w-2/5 cursor-default rounded-lg text-lg"
                                    {...register("order", { required: true })}
                                    defaultValue={PLAYLIST_ORDER.ordered}
                                    id="order"
                                >
                                    <option value={PLAYLIST_ORDER.random}>
                                        Random
                                    </option>
                                    <option value={PLAYLIST_ORDER.ordered}>
                                        Ordered
                                    </option>
                                </select>
                            </div>
                        </>
                    )}
                <div className="divider"></div>
                <div className="flex items-baseline justify-between">
                    <label
                        htmlFor="showTransition"
                        className="label text-2xl font-semibold"
                    >
                        Show transition
                    </label>
                    <input
                        type="checkbox"
                        className="toggle toggle-md cursor-default rounded-full"
                        id="showTransition"
                        defaultChecked={true}
                        {...register("showTransition")}
                    />
                </div>
                {watch("type") !== PLAYLIST_TYPES.TIME_OF_DAY &&
                    watch("type") !== PLAYLIST_TYPES.DAY_OF_WEEK && (
                        <div className="flex items-baseline justify-between">
                            <label
                                htmlFor="alwaysStartOnFirstImage"
                                className="label text-2xl font-semibold"
                            >
                                Always start on the first image
                            </label>
                            <input
                                type="checkbox"
                                className="toggle toggle-md cursor-default rounded-full"
                                id="alwaysStartOnFirstImage"
                                defaultChecked={false}
                                {...register("alwaysStartOnFirstImage")}
                            />
                        </div>
                    )}
                <div className="divider mb-0"></div>
                <div className="modal-action">
                    <button
                        type="submit"
                        className="btn btn-active btn-block rounded-lg uppercase"
                    >
                        Save
                    </button>
                </div>
            </form>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default PlaylistConfigurationModal;
