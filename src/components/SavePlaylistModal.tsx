import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../stores/monitors";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
const { goDaemon } = window.API_RENDERER;

interface Props {
	currentPlaylistName: string;
	onPlaylistChanged: () => void;
}

const SavePlaylistModal = ({ currentPlaylistName, onPlaylistChanged }: Props) => {
	const { setName, readPlaylist, setPlaylist, markClean } = usePlaylistStore(
		useShallow((s) => ({
			setName: s.setName,
			readPlaylist: s.readPlaylist,
			setPlaylist: s.setPlaylist,
			markClean: s.markClean,
		})),
	);
	const [error, showError] = useState({ state: false, message: "" });
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const modalRef = useRef<ModalHandle>(null);

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

	const form = useForm({
		defaultValues: { playlistName: "" },
		onSubmit: async ({ value }) => {
			if (monitorSelection.selectedMonitors.length === 0) {
				showError({
					state: true,
					message: "Select at least one display before saving a playlist.",
				});
				return;
			}
			setName(value.playlistName);
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
			const monitorTarget =
				monitorSelection.selectedMonitors.length === 1
					? monitorSelection.selectedMonitors[0]
					: "*";
			try {
				let savedId: number;
				if (playlist.id) {
					await goDaemon.updatePlaylist(playlist.id, {
						name: value.playlistName,
						images: playlist.images,
						configuration: playlist.configuration,
					});
					savedId = playlist.id;
				} else {
					const created = await goDaemon.createPlaylist({
						name: value.playlistName,
						images: playlist.images,
						configuration: playlist.configuration,
					});
					savedId = created.id;
					setPlaylist({
						...playlist,
						id: created.id,
						name: value.playlistName,
					});
				}

				if (monitorSelection.selectedMonitors.length > 0) {
					try {
						await goDaemon.startPlaylist(
							savedId,
							monitorTarget,
							monitorSelection.mode,
						);
					} catch (startErr) {
						console.error("Failed to start playlist:", startErr);
					}
				}

				markClean();
				onPlaylistChanged();
				closeModal();
			} catch (err) {
				console.error("Failed to save playlist:", err);
				let errorDetail = "Unknown error";
				if (err instanceof Error) errorDetail = err.message;
				showError({
					state: true,
					message: `Failed to save playlist: ${errorDetail}`,
				});
			}
		},
	});

	useEffect(() => {
		if (modalRef.current) {
			useModalStore.getState().register("savePlaylistModal", modalRef.current);
		}
		return () => useModalStore.getState().unregister("savePlaylistModal");
	}, []);

	const closeModal = () => {
		modalRef.current?.close();
	};

	const [prevPlaylistName, setPrevPlaylistName] = useState(currentPlaylistName);
	if (currentPlaylistName !== prevPlaylistName) {
		setPrevPlaylistName(currentPlaylistName);
		form.setFieldValue("playlistName", currentPlaylistName);
	}
	return (
		<Modal
			id="savePlaylistModal"
			ref={modalRef}
			onClose={closeModal}
			className="modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl"
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
				className="flex flex-col"
			>
				<h2 className="py-3 text-center text-4xl font-bold">Save Playlist</h2>
				<div className="divider"></div>
				<label htmlFor="playlistName" className="label mb-3 italic text-warning">
					Playlists with the same name will be overwritten.
				</label>

				<form.Field name="playlistName">
					{(field) => (
						<input
							type="text"
							id="playlistName"
							name={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							required
							draggable={false}
							className="input w-full mb-3 rounded-md text-lg"
							placeholder="Playlist Name"
						/>
					)}
				</form.Field>
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
		</Modal>
	);
};

export default SavePlaylistModal;
