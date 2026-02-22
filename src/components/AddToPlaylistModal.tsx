import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useImagesStore } from "../stores/images";
import type { Playlist } from "../../electron/daemon-go-types";
import Modal, { type ModalHandle } from "./Modal";
import { logger } from "../utils/logger";

interface Props {
	playlistsInDB: Playlist[];
	onPlaylistChanged: () => void;
}

const { goDaemon } = window.API_RENDERER;

const AddToPlaylistModal = ({ playlistsInDB, onPlaylistChanged }: Props) => {
	const selectedImages = useImagesStore((s) => s.selectedImages);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const modalRef = useRef<ModalHandle>(null);

	const closeModal = () => {
		setError("");
		setSuccess("");
	};

	const form = useForm({
		defaultValues: {
			selectPlaylist: playlistsInDB.length > 0 ? String(playlistsInDB[0].id) : "",
		},
		onSubmit: async ({ value }) => {
			try {
				setError("");
				setSuccess("");

				const selectedId = Number(value.selectPlaylist);
				const selectedPlaylist = playlistsInDB.find(
					(playlist) => playlist.id === selectedId,
				);

				if (!selectedPlaylist) {
					setError("Selected playlist not found");
					return;
				}

				const imageIdsToAdd = Array.from(selectedImages);

				if (imageIdsToAdd.length === 0) {
					setError("No images selected");
					return;
				}

				const fullPlaylist = await goDaemon.getPlaylist(selectedPlaylist.id);
				const existingImageIds = new Set(
					fullPlaylist.images.map((img) => img.image_id),
				);

				const newImageIds = imageIdsToAdd.filter(
					(id) => !existingImageIds.has(id),
				);

				if (newImageIds.length === 0) {
					setError("All selected images are already in this playlist");
					setTimeout(() => setError(""), 3000);
					return;
				}

				const updatedImages = [
					...fullPlaylist.images,
					...newImageIds.map((id) => ({ image_id: id })),
				];

				await goDaemon.updatePlaylist(selectedPlaylist.id, {
					images: updatedImages,
				});

				let successMsg: string;
				if (newImageIds.length > 1) {
					successMsg = `Added ${newImageIds.length} images to ${selectedPlaylist.name}`;
				} else {
					successMsg = `Added ${newImageIds.length} image to ${selectedPlaylist.name}`;
				}
				setSuccess(successMsg);
				onPlaylistChanged();

				setTimeout(() => {
					closeModal();
					const modal = modalRef.current;
					if (modal) modal.close();
				}, 1500);
			} catch (err) {
				logger.error("Failed to add images to playlist:", err);
				let errorMsg = "Failed to add images to playlist";
				if (err instanceof Error) errorMsg = err.message;
				setError(errorMsg);
			}
		},
	});

	return (
		<Modal id="AddToPlaylistModal" ref={modalRef} onClose={closeModal} className="modal-box flex flex-col max-w-lg xl:max-w-xl 2xl:max-w-2xl">
				<h2 className="select-none py-3 text-center text-4xl font-bold">
					Add to Playlist
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
				{success.length > 0 && (
					<div role="alert" className="alert alert-success m-0">
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
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{success}</span>
					</div>
				)}

				<div className="divider"></div>

				{selectedImages.size === 0 && (
					<section className="flex flex-col gap-3">
						<span className="text-center text-xl font-medium italic">
							No images selected
						</span>
					</section>
				)}

				{selectedImages.size > 0 && (
					<section className="mb-3">
						<span className="text-lg">
							Selected images: {selectedImages.size}
						</span>
					</section>
				)}

				{playlistsInDB && playlistsInDB.length === 0 && (
					<section className="flex flex-col gap-3">
						<span className="text-center text-xl font-medium italic">
							No playlists found, create a new one first
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

				{playlistsInDB &&
					playlistsInDB.length > 0 &&
					selectedImages.size > 0 && (
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

						<form.Field name="selectPlaylist">
							{(field) => (
								<select
									id="selectPlaylist"
									className="select select-bordered w-full rounded-md text-lg"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								>
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

							<div className="mt-3 flex justify-center gap-3">
								<button
									type="button"
									className="btn btn-md rounded-md uppercase"
								onClick={() => {
									closeModal();
									modalRef.current?.close();
								}}
							>
								Cancel
								</button>
								<button
									type="submit"
									className="btn btn-active btn-md rounded-md uppercase"
								>
									Add to Playlist
								</button>
							</div>
						</form>
					)}
		</Modal>
	);
};

export default AddToPlaylistModal;
