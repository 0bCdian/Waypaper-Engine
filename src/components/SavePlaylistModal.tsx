import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../stores/monitors";
import type { PlaylistImage } from "../../electron/daemon-go-types";
const { goDaemon } = window.API_RENDERER;

interface Props {
	currentPlaylistName: string;
	setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}
interface savePlaylistModalFields {
	playlistName: string;
}
const SavePlaylistModal = ({ currentPlaylistName, setShouldReload }: Props) => {
	const { setName, readPlaylist } = usePlaylistStore(
		useShallow((s) => ({
			setName: s.setName,
			readPlaylist: s.readPlaylist,
		})),
	);
	const [error, showError] = useState({ state: false, message: "" });
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const modalRef = useRef<HTMLDialogElement>(null);
	const { register, handleSubmit, setValue } =
		useForm<savePlaylistModalFields>();
	const closeModal = () => {
		modalRef.current?.close();
	};
	const checkDuplicateTimes = (images: PlaylistImage[]) => {
		let duplicatesExist = false;
		const maxImageIndex = images.length;
		let lastTime = -1;
		for (let current = 0; current < maxImageIndex; current++) {
			const time = images[current].time;
			if (time != null && time === lastTime) {
				duplicatesExist = true;
			} else if (time != null) {
				lastTime = time;
			}
		}
		return duplicatesExist;
	};
	const onSubmit: SubmitHandler<savePlaylistModalFields> = async (data) => {
		setName(data.playlistName);
		const playlist = readPlaylist();
		if (playlist.configuration.type === "time_of_day") {
			if (checkDuplicateTimes(playlist.images)) {
				showError({
					state: true,
					message:
						"There are duplicate times in images, check them before resubmitting.",
				});
				return;
			} else {
				showError({ state: false, message: "" });
			}
		}
		if (monitorSelection.selectedMonitors.length < 1) {
			showError({
				state: true,
				message: "Select at least one monitor to save playlist.",
			});
			setTimeout(() => {
				showError({ state: false, message: "" });
			}, 3000);
			return;
		}
		try {
			if (playlist.id) {
				// Update existing playlist
				await goDaemon.updatePlaylist(playlist.id, {
					name: data.playlistName,
					images: playlist.images,
					configuration: playlist.configuration,
				});
			} else {
				// Create new playlist
				await goDaemon.createPlaylist({
					name: data.playlistName,
					images: playlist.images,
					configuration: playlist.configuration,
				});
			}
			setShouldReload(true);
			closeModal();
		} catch (err) {
			console.error("Failed to save playlist:", err);
			showError({
				state: true,
				message: `Failed to save playlist: ${err instanceof Error ? err.message : "Unknown error"}`,
			});
		}
	};
	useEffect(() => {
		setValue("playlistName", currentPlaylistName);
	}, [currentPlaylistName, setValue]);
	return (
		<dialog
			id="savePlaylistModal"
			className="modal select-none"
			draggable={false}
			ref={modalRef}
		>
			<form
				onSubmit={(e) => {
					void handleSubmit(onSubmit)(e);
				}}
				className="form-control modal-box rounded-xl"
			>
				<h2 className="py-3 text-center text-4xl font-bold">Save Playlist</h2>
				<div className="divider"></div>
				<label htmlFor="playlistName" className="label italic text-warning">
					Playlists with the same name will be overwritten.
				</label>

				<input
					type="text"
					{...register("playlistName", { required: true })}
					id="playlistName"
					required
					draggable={false}
					className="input input-md mb-3 rounded-md text-lg"
					placeholder="Playlist Name"
				/>
				<div className="divider"></div>
				{error.state && (
					<label
						htmlFor="playlistName"
						className="label text-lg italic text-error"
					>
						{error.message}
					</label>
				)}
				<button type="submit" className="btn btn-active rounded-lg uppercase">
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
