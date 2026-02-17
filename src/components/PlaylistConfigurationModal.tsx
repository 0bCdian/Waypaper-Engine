import { useForm, type SubmitHandler } from "react-hook-form";
import { useRef, useEffect, useState } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import {
	type PLAYLIST_TYPES_TYPE,
	type PLAYLIST_ORDER_TYPES,
	PLAYLIST_TYPES,
	PLAYLIST_ORDER,
} from "../../shared/types/playlist";
import { toSeconds, toHoursAndMinutes } from "../utils/utilities";
import NeoCloseButton from "./NeoCloseButton";
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
	const { setConfiguration, playlist } = usePlaylistStore(
		useShallow((s) => ({
			setConfiguration: s.setConfiguration,
			playlist: s.playlist,
		})),
	);
	const { register, handleSubmit, watch, setValue } = useForm<Inputs>();
	const containerRef = useRef<HTMLDialogElement>(null);
	const closeModal = () => {
		containerRef.current?.close();
	};
	const classNameDisabled =
		playlist.images.length > 7 ? "bg-error text-error-content" : "";
	const onSubmit: SubmitHandler<Inputs> = (data) => {
		switch (data.type) {
			case "timer":
				if (data.hours === null || data.minutes === null) {
					console.error("Hours and minutes are required");
				} else {
				const interval = toSeconds(
					parseInt(data.hours, 10),
					parseInt(data.minutes, 10),
				);
					const configuration = {
						type: data.type,
						order: data.order ?? undefined,
						show_animations: data.showTransition,
						always_start_on_first_image: data.alwaysStartOnFirstImage,
						interval,
					};
					setConfiguration(configuration);
				}
				break;
			case "time_of_day":
				setConfiguration({
					type: data.type,
					order: undefined,
					show_animations: data.showTransition,
					interval: undefined,
					always_start_on_first_image: false,
				});
				break;
		case "day_of_week":
			if (playlist.images.length > 7) {
				setShowError(true);
				setTimeout(() => {
					setShowError(false);
				}, 5000);
				return;
			}
				setConfiguration({
					type: data.type,
					order: undefined,
					show_animations: data.showTransition,
					interval: undefined,
					always_start_on_first_image: false,
				});
				break;
			case "manual":
				setConfiguration({
					type: data.type,
					order: data.order ?? undefined,
					show_animations: data.showTransition,
					interval: undefined,
					always_start_on_first_image: data.alwaysStartOnFirstImage,
				});
				break;
			default:
				console.error("Invalid playlist type");
		}
		closeModal();
	};
	const hours = watch("hours");
	const minutes = watch("minutes");
	useEffect(() => {
		if (hours === null || minutes === null) return;
		const parsedHours = parseInt(hours, 10);
		const parsedMinutes = parseInt(minutes, 10);
		if (parsedMinutes === 60) {
			setValue("hours", (parsedHours + 1).toString());
			setValue("minutes", "0");
		}
		if (parsedMinutes === 0 && parsedHours === 0) {
			setValue("minutes", "1");
		}
	}, [hours, minutes, setValue]);
	useEffect(() => {
		const interval = playlist.configuration.interval;
		if (interval != null) {
			const { hours, minutes } = toHoursAndMinutes(interval);
			setValue("hours", hours.toString());
			setValue("minutes", minutes.toString());
		}
		setValue("type", playlist.configuration.type);
		setValue("order", playlist.configuration.order ?? null);
		setValue("showTransition", playlist.configuration.show_animations);
		setValue(
			"alwaysStartOnFirstImage",
			playlist.configuration.always_start_on_first_image,
		);
	}, [playlist, setValue]);
	return (
		<dialog
			id="playlistConfigurationModal"
			ref={containerRef}
			className="modal select-none"
			draggable={false}
		>
			<div className="modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl">
				<NeoCloseButton onClick={closeModal} />
				<h2 className="mb-4 text-2xl xl:text-3xl 2xl:text-4xl font-bold text-center select-none">
					Playlist Settings
				</h2>

				{/* Error alert with smooth transition */}
				<div
					data-visible={showError}
					className="alert alert-error mb-4 opacity-0 transition-opacity duration-300 data-[visible=true]:opacity-100"
					style={{ display: showError ? undefined : "none" }}
				>
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
					<span className="text-sm xl:text-base">
						Weekly playlists cannot have more than 7 images.
					</span>
				</div>

				<form
					className="flex flex-col gap-4 xl:gap-5 2xl:gap-6"
					onSubmit={(e) => {
						void handleSubmit(onSubmit)(e);
					}}
				>
					{/* Wallpaper change mode */}
					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Change Wallpaper
						</legend>

						<select
							id="type"
							className="select select-bordered w-full text-base xl:text-lg"
							defaultValue="timer"
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
							<option value={PLAYLIST_TYPES.MANUAL}>Manual</option>
						</select>

						{watch("type") === PLAYLIST_TYPES.TIMER && (
							<div className="mt-3 grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="hours"
										className="label text-sm xl:text-base font-medium"
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
											min: 0,
										})}
										className="input input-bordered xl:input-lg w-full"
									/>
								</div>
								<div>
									<label
										htmlFor="minutes"
										className="label text-sm xl:text-base font-medium"
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
											required: true,
										})}
										className="input input-bordered xl:input-lg w-full"
									/>
								</div>
							</div>
						)}
					</fieldset>

					{/* Order (only for timer / manual) */}
					{watch("type") !== PLAYLIST_TYPES.TIME_OF_DAY &&
						watch("type") !== PLAYLIST_TYPES.DAY_OF_WEEK && (
							<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
								<legend className="fieldset-legend text-base 2xl:text-lg">
									Order
								</legend>
								<select
									className="select select-bordered w-full text-base xl:text-lg"
									{...register("order", { required: true })}
									defaultValue={PLAYLIST_ORDER.ordered}
									id="order"
								>
									<option value={PLAYLIST_ORDER.random}>Random</option>
									<option value={PLAYLIST_ORDER.ordered}>
										Ordered
									</option>
								</select>
							</fieldset>
						)}

					{/* Options */}
					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Options
						</legend>

						<label
							htmlFor="showTransition"
							className="label cursor-pointer justify-between"
						>
							<span className="text-sm xl:text-base 2xl:text-lg font-medium">
								Show transition
							</span>
							<input
								type="checkbox"
								className="toggle toggle-primary"
								id="showTransition"
								defaultChecked={true}
								{...register("showTransition")}
							/>
						</label>

						{watch("type") !== PLAYLIST_TYPES.TIME_OF_DAY &&
							watch("type") !== PLAYLIST_TYPES.DAY_OF_WEEK && (
								<label
									htmlFor="alwaysStartOnFirstImage"
									className="label cursor-pointer justify-between"
								>
									<span className="text-sm xl:text-base 2xl:text-lg font-medium">
										Always start on the first image
									</span>
									<input
										type="checkbox"
										className="toggle toggle-primary"
										id="alwaysStartOnFirstImage"
										defaultChecked={false}
										{...register("alwaysStartOnFirstImage")}
									/>
								</label>
							)}
					</fieldset>

					<button
						type="submit"
						className="btn btn-primary btn-block xl:btn-lg mt-2"
					>
						Save
					</button>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="button">close</button>
			</form>
		</dialog>
	);
};

export default PlaylistConfigurationModal;
