import { useRef, useState, useEffect } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useForm, useStore } from "@tanstack/react-form";
import type { rendererPlaylist } from "../types/rendererTypes";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { confirmDialog } from "./ConfirmDialog";

interface Props {
	playlistsInDB: Playlist[];
	currentPlaylistName: string;
	onPlaylistChanged: () => void;
}

const { goDaemon } = window.API_RENDERER;

const LoadPlaylistModal = ({
	playlistsInDB,
	onPlaylistChanged,
	currentPlaylistName,
}: Props) => {
	const { clearPlaylist, setPlaylist } = usePlaylistStore(
		useShallow((s) => ({
			clearPlaylist: s.clearPlaylist,
			setPlaylist: s.setPlaylist,
		})),
	);
	const [error, setError] = useState("");
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const modalRef = useRef<ModalHandle>(null);

	const form = useForm({
		defaultValues: {
			selectPlaylist: playlistsInDB.length > 0 ? String(playlistsInDB[0].id) : "",
		},
		onSubmit: async ({ value }) => {
			const selectedId = Number(value.selectPlaylist);
			const selectedPlaylist = playlistsInDB.find((p) => p.id === selectedId);

			if (selectedPlaylist === undefined) {
				setError("Please select a valid playlist");
				setTimeout(() => setError(""), 3000);
				return;
			}

			if (monitorSelection.selectedMonitors.length < 1) {
				setError("Select at least one display before loading a playlist");
				setTimeout(() => setError(""), 3000);
				return;
			}

			try {
				const fullPlaylist = await goDaemon.getPlaylist(selectedPlaylist.id);

				const currentPlaylist: rendererPlaylist = {
					id: fullPlaylist.id,
					name: fullPlaylist.name,
					configuration: fullPlaylist.configuration,
					images: fullPlaylist.images,
				};

				clearPlaylist();
				setPlaylist(currentPlaylist);

				void useImagesStore
					.getState()
					.fetchMissingImages(
						fullPlaylist.images.map((img) => img.image_id),
					);

				const monitor =
					monitorSelection.selectedMonitors.length === 1
						? monitorSelection.selectedMonitors[0]
						: "*";
				await goDaemon.startPlaylist(
					fullPlaylist.id,
					monitor,
					monitorSelection.mode,
				);

				closeModal();
			} catch (err) {
				console.error("Failed to load playlist:", err);
				setError(
					`Failed to load playlist: ${err instanceof Error ? err.message : "Unknown error"}`,
				);
				setTimeout(() => setError(""), 5000);
			}
		},
	});

	const currentSelection = useStore(form.store, (s) => s.values.selectPlaylist);

	useEffect(() => {
		if (modalRef.current) {
			useModalStore.getState().register("LoadPlaylistModal", modalRef.current);
		}
		return () => useModalStore.getState().unregister("LoadPlaylistModal");
	}, []);

	const closeModal = () => {
		modalRef.current?.close();
	};

	return (
		<Modal id="LoadPlaylistModal" ref={modalRef} onClose={closeModal} className="modal-box flex flex-col max-w-lg xl:max-w-xl 2xl:max-w-2xl">
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
				{playlistsInDB && playlistsInDB.length === 0 && (
					<section className="flex flex-col gap-3">
						<span className="text-center text-xl font-medium italic">
							No playlists found, refresh or create a new one
						</span>
						<button
							type="button"
							className="btn btn-active btn-block uppercase"
							onClick={() => {
								onPlaylistChanged();
							}}
						>
							Refresh playlists
						</button>
					</section>
				)}
				{playlistsInDB && playlistsInDB.length > 0 && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
						className="form-control flex flex-col gap-5"
					>
						<label htmlFor="selectPlaylist" className="label text-lg">
							Select Playlist
						</label>

						<div className="flex gap-10 align-baseline">
							<form.Field name="selectPlaylist">
								{(field) => (
									<select
										id="selectPlaylist"
										className="select select-bordered basis-[90%] rounded-md text-lg"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									>
										<option value="" disabled>
											Select a playlist...
										</option>
										{playlistsInDB.map((playlist) => (
											<option
												key={playlist.id}
												value={String(playlist.id)}
											>
												{playlist.name}
											</option>
										))}
									</select>
								)}
							</form.Field>
							<button
								type="button"
								className="btn btn-error btn-md rounded-md uppercase"
								onClick={async () => {
									const currentId = Number(currentSelection);
									if (!currentSelection || Number.isNaN(currentId)) {
										setError("Please select a playlist to delete");
										return;
									}

									const playlistToDelete = playlistsInDB.find(
										(p) => p.id === currentId,
									);
									if (!playlistToDelete) return;

								const shouldDelete = await confirmDialog({
									title: "Delete Playlist",
									message: `Are you sure you want to delete "${playlistToDelete.name}"? This action cannot be undone.`,
									confirmLabel: "Delete",
									cancelLabel: "Cancel",
									danger: true,
								});
								if (shouldDelete) {
									try {
										await goDaemon.stopPlaylist(playlistToDelete.id).catch(() => {});
										await goDaemon.deletePlaylist(playlistToDelete.id);
										onPlaylistChanged();
										setError("");

										if (currentPlaylistName !== "") {
											clearPlaylist();
										}
									} catch (deleteErr) {
										console.error(
											"Failed to delete playlist:",
											deleteErr,
										);
										setError(
											`Failed to delete playlist: ${deleteErr instanceof Error ? deleteErr.message : "Unknown error"}`,
										);
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
		</Modal>
	);
};

export default LoadPlaylistModal;
