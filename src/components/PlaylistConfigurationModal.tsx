import { useForm, type SubmitHandler } from 'react-hook-form';
import { useRef, useEffect, useState } from 'react';
import playlistStore from '../stores/playlist';
import {
    type PLAYLIST_TYPES_TYPE,
    type PLAYLIST_ORDER_TYPES,
    PLAYLIST_TYPES,
    PLAYLIST_ORDER
} from '../../shared/types/playlist';
import { toMS, toHoursAndMinutes } from '../utils/utilities';
interface Inputs {
    playlistType: PLAYLIST_TYPES_TYPE;
    order: PLAYLIST_ORDER_TYPES | null;
    hours: string | null;
    minutes: string | null;
    showTransition: boolean;
}

const PlaylistConfigurationModal = () => {
    const [showError, setShowError] = useState(false);
    const { setConfiguration, readPlaylist } = playlistStore();
    const { register, handleSubmit, watch, setValue } = useForm<Inputs>();
    const containerRef = useRef<HTMLDialogElement>(null);
    const closeModal = () => {
        containerRef.current?.close();
    };
    const playlist = readPlaylist();
    const classNameDisabled =
        playlist.images.length > 7 ? 'bg-red-900 text-stone-100' : '';
    const onSubmit: SubmitHandler<Inputs> = data => {
        switch (data.playlistType) {
            case 'timer':
                if (data.hours === null || data.minutes === null) {
                    console.error('Hours and minutes are required');
                } else {
                    const interval = toMS(
                        parseInt(data.hours),
                        parseInt(data.minutes)
                    );
                    const configuration = {
                        playlistType: data.playlistType,
                        order: data.order,
                        showAnimations: data.showTransition,
                        interval
                    };
                    setConfiguration(configuration);
                }
                break;
            case 'timeofday':
                setConfiguration({
                    playlistType: data.playlistType,
                    order: null,
                    showAnimations: data.showTransition,
                    interval: null
                });
                break;
            case 'dayofweek':
                if (playlist.images.length > 7) {
                    setShowError(prevState => !prevState);
                    setTimeout(() => {
                        setShowError(prevState => !prevState);
                    }, 5000);
                    return;
                }
                setConfiguration({
                    playlistType: data.playlistType,
                    order: null,
                    showAnimations: data.showTransition,
                    interval: null
                });
                break;
            case 'never':
                setConfiguration({
                    playlistType: data.playlistType,
                    order: data.order,
                    showAnimations: data.showTransition,
                    interval: null
                });
                break;
            default:
                console.error('Invalid playlist type');
        }
        closeModal();
    };
    const hours = watch('hours');
    const minutes = watch('minutes');
    useEffect(() => {
        if (hours === null || minutes === null) return;
        const parsedHours = parseInt(hours);
        const parsedMinutes = parseInt(minutes);
        if (parsedMinutes === 60) {
            setValue('hours', (parsedHours + 1).toString());
            setValue('minutes', '0');
        }
        if (parsedMinutes === 0 && parsedHours === 0) {
            setValue('minutes', '1');
        }
    }, [hours, minutes]);
    useEffect(() => {
        const interval = playlist.configuration.interval;
        if (interval !== null) {
            const { hours, minutes } = toHoursAndMinutes(interval);
            setValue('hours', hours.toString());
            setValue('minutes', minutes.toString());
        }
        setValue('playlistType', playlist.configuration.playlistType);
        setValue('order', playlist.configuration.order);
        setValue(
            'showTransition',
            Boolean(playlist.configuration.showAnimations)
        );
    }, [playlist]);
    return (
        <dialog
            id="playlistConfigurationModal"
            ref={containerRef}
            className="modal "
        >
            <form
                className="modal-box form-control rounded-xl"
                onSubmit={e => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <h2 className="font-bold text-4xl text-center">
                    Playlist Settings
                </h2>
                {showError && (
                    <div className="alert alert-error mt-5">
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
                        <span>
                            Weekly playlists cannot have more than 7 images.
                        </span>
                    </div>
                )}
                <div className="divider"></div>
                <div className="flex justify-between items-baseline">
                    <label
                        htmlFor="playlistType"
                        className="label text-3xl font-semibold shrink"
                    >
                        Change wallpaper
                    </label>
                    <select
                        id="playlistType"
                        className="select select-bordered  text-lg w-2/5 rounded-lg cursor-default"
                        defaultValue={'timer'}
                        {...register('playlistType', { required: true })}
                    >
                        <option value={PLAYLIST_TYPES.timer}>On a timer</option>
                        <option value={PLAYLIST_TYPES.timeofday}>
                            Time of day
                        </option>
                        <option
                            disabled={playlist.images.length > 7}
                            className={classNameDisabled}
                            value={PLAYLIST_TYPES.dayofweek}
                        >
                            Day of week
                        </option>
                        <option value={PLAYLIST_TYPES.never}>Never</option>
                    </select>
                </div>
                {watch('playlistType') === PLAYLIST_TYPES.timer && (
                    <div className="flex justify-end items-baseline gap-1">
                        <div className="flex flex-col w-1/5 ">
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
                                {...register('hours', {
                                    required: true,
                                    min: 0
                                })}
                                className="input input-bordered input-sm focus:outline-none text-lg font-medium rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col w-1/5">
                            <label
                                className="label text-lg font-medium rounded-lg"
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
                                {...register('minutes', {
                                    required: true
                                })}
                                className="input input-bordered input-sm  rounded-lg focus:outline-none text-lg font-medium"
                            />
                        </div>
                    </div>
                )}
                {watch('playlistType') !== PLAYLIST_TYPES.timeofday &&
                    watch('playlistType') !== PLAYLIST_TYPES.dayofweek && (
                        <>
                            <div className="divider"></div>
                            <div className="flex justify-between items-baseline ">
                                <label
                                    htmlFor="order"
                                    className="label text-3xl font-semibold"
                                >
                                    Order
                                </label>
                                <select
                                    className="select select-bordered text-lg w-2/5 rounded-lg cursor-default"
                                    {...register('order', { required: true })}
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
                <div className="flex justify-between items-baseline">
                    <label
                        htmlFor="showTransition"
                        className="label text-2xl font-semibold"
                    >
                        Show transition
                    </label>
                    <input
                        type="checkbox"
                        className="toggle toggle-md rounded-full cursor-default"
                        id="showTransition"
                        defaultChecked={true}
                        {...register('showTransition')}
                    />
                </div>
                <div className="divider mb-0"></div>
                <div className="modal-action">
                    <button
                        type="submit"
                        className="btn btn-active btn-block uppercase rounded-lg"
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
