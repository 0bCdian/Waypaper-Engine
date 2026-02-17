import { useEffect, useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../stores/monitors";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import NeoCloseButton from "./NeoCloseButton";
const { goDaemon } = window.API_RENDERER;

interface Props {
	currentPlaylistName: string;
	setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}
interface savePlaylistModalFields {
	playlistName: string;
}
const SavePlaylistModal = ({ currentPlaylistName, setShouldReload }: Props) => {
	const { setName, readPlaylist, setPlaylist } = usePlaylistStore(
		useShallow((s) => ({
			setName: s.setName,
			readPlaylist: s.readPlaylist,
			setPlaylist: s.setPlaylist,
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
		try {
			let savedId: number;
			if (playlist.id) {
				await goDaemon.updatePlaylist(playlist.id, {
					name: data.playlistName,
					images: playlist.images,
					configuration: playlist.configuration,
				});
				savedId = playlist.id;
			} else {
				const created = await goDaemon.createPlaylist({
					name: data.playlistName,
					images: playlist.images,
					configuration: playlist.configuration,
				});
				savedId = created.id;
				setPlaylist({
					...playlist,
					id: created.id,
					name: data.playlistName,
				});
			}

			// Start playlist on monitors if any are selected
			if (monitorSelection.selectedMonitors.length > 0) {
				const monitor =
					monitorSelection.selectedMonitors.length === 1
						? monitorSelection.selectedMonitors[0]
						: "*";
				try {
					await goDaemon.startPlaylist(
						savedId,
						monitor,
						monitorSelection.mode,
					);
				} catch (startErr) {
					console.error("Failed to start playlist:", startErr);
				}
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
				className="form-control modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl"
			>
				<NeoCloseButton onClick={closeModal} />
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
