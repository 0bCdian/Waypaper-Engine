import { useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useImagesStore } from "../stores/images";
import type { Playlist } from "../../electron/daemon-go-types";
import NeoCloseButton from "./NeoCloseButton";

interface Input {
	selectPlaylist: string;
}

interface Props {
	playlistsInDB: Playlist[];
	setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}

const { goDaemon } = window.API_RENDERER;

const AddToPlaylistModal = ({ playlistsInDB, setShouldReload }: Props) => {
	const selectedImages = useImagesStore((s) => s.selectedImages);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const { register, handleSubmit } = useForm<Input>();
	const modalRef = useRef<HTMLDialogElement>(null);

	const closeModal = () => {
		setError("");
		setSuccess("");
		modalRef.current?.close();
	};

	const onSubmit: SubmitHandler<Input> = async (data) => {
		try {
			setError("");
			setSuccess("");

		const selectedId = Number(data.selectPlaylist);
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

			// Get existing playlist
			const fullPlaylist = await goDaemon.getPlaylist(selectedPlaylist.id);
			const existingImageIds = new Set(
				fullPlaylist.images.map((img) => img.image_id),
			);

			// Filter out duplicates
			const newImageIds = imageIdsToAdd.filter(
				(id) => !existingImageIds.has(id),
			);

			if (newImageIds.length === 0) {
				setError("All selected images are already in this playlist");
				setTimeout(() => setError(""), 3000);
				return;
			}

			// Update playlist with new images
			const updatedImages = [
				...fullPlaylist.images,
				...newImageIds.map((id) => ({ image_id: id })),
			];

			await goDaemon.updatePlaylist(selectedPlaylist.id, {
				images: updatedImages,
			});

			setSuccess(
				`Added ${newImageIds.length} image${newImageIds.length > 1 ? "s" : ""} to ${selectedPlaylist.name}`,
			);
			setShouldReload(true);

			setTimeout(() => {
				closeModal();
			}, 1500);
		} catch (err) {
			console.error("Failed to add images to playlist:", err);
			setError(
				err instanceof Error ? err.message : "Failed to add images to playlist",
			);
		}
	};

	return (
		<dialog id="AddToPlaylistModal" className="modal" ref={modalRef}>
			<div className="modal-box flex flex-col max-w-lg xl:max-w-xl 2xl:max-w-2xl">
				<NeoCloseButton onClick={closeModal} />
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
								setShouldReload(true);
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
								void handleSubmit(onSubmit)(e);
							}}
							className="form-control flex flex-col gap-5"
						>
							<label htmlFor="selectPlaylist" className="label text-lg">
								Select Playlist
							</label>

						<select
							id="selectPlaylist"
							className="select select-bordered w-full rounded-md text-lg"
							defaultValue={
								playlistsInDB.length > 0
									? String(playlistsInDB[0].id)
									: ""
							}
							{...register("selectPlaylist", {
								required: true,
							})}
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
									Add to Playlist
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

export default AddToPlaylistModal;
