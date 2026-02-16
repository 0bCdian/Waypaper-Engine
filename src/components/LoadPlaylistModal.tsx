import { useRef, useState } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import { useForm, type SubmitHandler } from "react-hook-form";
import type { rendererPlaylist } from "../types/rendererTypes";
import { useMonitorStore } from "../stores/monitors";
import type { Playlist } from "../../electron/daemon-go-types";

interface Input {
	selectPlaylist: string;
}

interface Props {
	playlistsInDB: Playlist[];
	currentPlaylistName: string;
	setShouldReload: React.Dispatch<React.SetStateAction<boolean>>;
}

const { goDaemon } = window.API_RENDERER;

const LoadPlaylistModal = ({
	playlistsInDB,
	setShouldReload,
	currentPlaylistName,
}: Props) => {
	const { clearPlaylist, setPlaylist } = usePlaylistStore(
		useShallow((s) => ({
			clearPlaylist: s.clearPlaylist,
			setPlaylist: s.setPlaylist,
		})),
	);
	const [error, setError] = useState("");
	const { register, handleSubmit, watch } = useForm<Input>();
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const modalRef = useRef<HTMLDialogElement>(null);

	const closeModal = () => {
		modalRef.current?.close();
	};

	const onSubmit: SubmitHandler<Input> = async (data) => {
		clearPlaylist();
		const selectedPlaylist = playlistsInDB.find((playlist) => {
			return playlist.name === data.selectPlaylist;
		});

		if (selectedPlaylist !== undefined) {
			// Fetch the full playlist with images
			const fullPlaylist = await goDaemon.getPlaylist(selectedPlaylist.id);

			const currentPlaylist: rendererPlaylist = {
				id: fullPlaylist.id,
				name: fullPlaylist.name,
				configuration: fullPlaylist.configuration,
				images: fullPlaylist.images,
			};

			if (monitorSelection.selectedMonitors.length < 1) {
				setError("Select at least one display before setting a playlist");
				setTimeout(() => setError(""), 3000);
				return;
			}

			setPlaylist(currentPlaylist);

			// Start playlist on selected monitor
			const monitor =
				monitorSelection.selectedMonitors.length === 1
					? monitorSelection.selectedMonitors[0]
					: "*";
			goDaemon.startPlaylist(fullPlaylist.id, monitor, monitorSelection.mode);
		}
		closeModal();
	};

	return (
		<dialog id="LoadPlaylistModal" className="modal" ref={modalRef}>
			<div className="container modal-box flex flex-col">
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
								setShouldReload(true);
							}}
						>
							Refresh playlists
						</button>
					</section>
				)}
				{playlistsInDB && playlistsInDB.length > 0 && (
					<form
						onSubmit={(e) => {
							void handleSubmit(onSubmit)(e);
						}}
						className="form-control flex flex-col gap-5"
					>
						<label htmlFor="selectPlaylist" className="label text-lg">
							Select Playlist
						</label>

						<div className="flex gap-10 align-baseline">
							<select
								id="selectPlaylist"
								className="select select-bordered basis-[90%] rounded-md text-lg"
								defaultValue={
									playlistsInDB.length > 0 ? playlistsInDB[0].name : ""
								}
								{...register("selectPlaylist", {
									required: true,
								})}
							>
								<option value="" disabled>
									Select a playlist...
								</option>
								{playlistsInDB.map((playlist) => (
									<option key={playlist.id} value={playlist.name}>
										{playlist.name}
									</option>
								))}
							</select>
							<button
								type="button"
								className="btn btn-error btn-md rounded-md uppercase"
								onClick={async () => {
									const current = watch("selectPlaylist");
									if (!current || current.trim() === "") {
										setError("Please select a playlist to delete");
										return;
									}

									const playlistToDelete = playlistsInDB.find(
										(p) => p.name === current,
									);
									if (!playlistToDelete) return;

									const shouldDelete = window.confirm(
										`Are you sure to delete ${current}?`,
									);
									if (shouldDelete) {
										try {
											await goDaemon.deletePlaylist(playlistToDelete.id);
											setShouldReload(true);
											setError("");

											if (currentPlaylistName !== "") {
												clearPlaylist();
											}
										} catch (error) {
											console.error("Failed to delete playlist:", error);
											setError(
												`Failed to delete playlist: ${error instanceof Error ? error.message : "Unknown error"}`,
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
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>close</button>
			</form>
		</dialog>
	);
};

export default LoadPlaylistModal;
