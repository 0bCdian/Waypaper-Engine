import { DndContext, type DragEndEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { playlistStore } from "../stores/playlist";
import openImagesStore from "../hooks/useOpenImages";
import { motion, AnimatePresence } from "framer-motion";
import { useMonitorStore } from "../stores/monitors";
import type { openFileAction } from "../../shared/types";
import { useSetLastActivePlaylist } from "../hooks/useSetLastActivePlaylist";
import type { PlaylistImage } from "../../electron/daemon-go-types";

let firstRender = true;
const { goDaemon } = window.API_RENDERER;
const MiniPlaylistCard = lazy(async () => await import("./MiniPlaylistCard"));

function PlaylistTrack() {
	const {
		playlist,
		lastAddedImageID,
		movePlaylistArrayOrder,
		clearPlaylist,
		setPlaylist,
	} = playlistStore();
	const { monitorSelection } = useMonitorStore();
	const { openImages, isActive } = openImagesStore();
	useSetLastActivePlaylist();

	const handleClickAddImages = useCallback((action: openFileAction) => {
		void openImages({ action });
	}, []);

	const reorderSortingCriteria = useCallback(() => {
		const newArray = [...playlist.images].sort(
			(a: PlaylistImage, b: PlaylistImage) => {
				if (a.time == null || b.time == null) return 0;
				return a.time - b.time;
			},
		);
		movePlaylistArrayOrder(newArray);
	}, [playlist]);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { over, active } = event;
			if (over === null) return;
			if (over.id !== active.id) {
				const oldindex = playlist.images.findIndex(
					(element) => element.image_id === active.id,
				);
				const newIndex = playlist.images.findIndex(
					(element) => element.image_id === over?.id,
				);
				const oldImage = playlist.images[oldindex];
				const newImage = playlist.images[newIndex];
				const buffer = oldImage.time;
				oldImage.time = newImage.time;
				newImage.time = buffer;
				const newArrayOrder = arrayMove(playlist.images, oldindex, newIndex);
				if (playlist.configuration.type === "time_of_day") {
					reorderSortingCriteria();
					return;
				}
				movePlaylistArrayOrder(newArrayOrder);
			}
		},
		[playlist],
	);

	const [playlistArray, sortingCriteria] = useMemo(() => {
		const lastIndex = playlist.images.length - 1;
		const sortingCriteria: number[] = [];
		const elements = playlist.images.map((img, index) => {
			const isLast =
				playlist.configuration.type === "time_of_day"
					? lastAddedImageID === img.image_id
					: index === lastIndex;
			sortingCriteria.push(img.image_id);
			return (
				<Suspense key={img.image_id}>
					<MiniPlaylistCard
						isLast={isLast}
						reorderSortingCriteria={reorderSortingCriteria}
						type={playlist.configuration.type}
						index={index}
						playlistImage={img}
					/>
				</Suspense>
			);
		});
		return [elements, sortingCriteria];
	}, [playlist]);

	useEffect(() => {
		if (firstRender) {
			firstRender = false;
			return;
		}
		if (playlist.images.length === 0) {
			clearPlaylist();
		}
	}, [playlist.images]);

	useEffect(() => {
		goDaemon.on("playlists_updated", () => {
			// Re-fetch if we have an active playlist
			if (playlist.id) {
				goDaemon.getPlaylist(playlist.id).then((fullPlaylist) => {
					if (fullPlaylist) {
						setPlaylist({
							id: fullPlaylist.id,
							name: fullPlaylist.name,
							configuration: fullPlaylist.configuration,
							images: fullPlaylist.images,
						});
					}
				});
			}
		});
	}, [playlist.id]);

	useEffect(() => {
		if (playlist.configuration.type === "time_of_day") {
			reorderSortingCriteria();
		}
	}, [playlist.images.length, playlist.configuration.type]);

	return (
		<div className="mb-2 flex w-full flex-col gap-5">
			<div className="grid grid-cols-3 items-center gap-5 sm:flex-row xl:flex">
				<span className="col-span-3 text-4xl font-bold">
					{playlistArray.length > 0
						? `Playlist (${playlistArray.length})`
						: "Playlist"}
				</span>
				<div className="dropdown dropdown-top">
					<button
						tabIndex={0}
						role="button"
						className="btn btn-primary w-full rounded-lg uppercase"
					>
						Add images
					</button>
					<ul
						tabIndex={0}
						className="menu dropdown-content z-10 mb-1 w-52 rounded-box bg-base-100 p-2 shadow-sm"
					>
						<li>
							<a
								className="text-lg text-base-content"
								onClick={
									isActive
										? undefined
										: () => handleClickAddImages("file")
								}
							>
								Individual images
							</a>
						</li>
						<li>
							<a
								className="text-lg text-base-content"
								onClick={
									isActive
										? undefined
										: () => handleClickAddImages("folder")
								}
							>
								Image directory
							</a>
						</li>
					</ul>
				</div>
				<button
					onClick={() => {
						// @ts-expect-error daisyui fix
						window.LoadPlaylistModal.showModal();
					}}
					className="btn btn-primary rounded-lg uppercase"
				>
					Load Playlist
				</button>
				<button
					onClick={() => {
						const monitor =
							monitorSelection.selectedMonitors.length === 1
								? monitorSelection.selectedMonitors[0]
								: "*";
						goDaemon.setRandomWallpaper(monitor, monitorSelection.mode);
					}}
					className="btn btn-primary rounded-lg uppercase"
				>
					Random Image
				</button>

				<AnimatePresence mode="sync">
					{playlist.images.length > 1 && (
						<>
							<motion.button
								initial={{ y: 100 }}
								transition={{ duration: 0.25, ease: "easeInOut" }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: 100, opacity: 0 }}
								onClick={() => {
									// @ts-expect-error daisyui fix
									window.savePlaylistModal.showModal();
								}}
								className="btn btn-primary rounded-lg uppercase"
							>
								Save
							</motion.button>
							<motion.button
								initial={{ y: 100 }}
								transition={{ duration: 0.25, ease: "easeInOut" }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: 100, opacity: 0 }}
								onClick={() => {
									// @ts-expect-error daisyui fix
									window.playlistConfigurationModal.showModal();
								}}
								className="btn btn-primary rounded-lg uppercase"
							>
								Configure
							</motion.button>
						</>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{playlist.images.length > 1 && (
						<motion.button
							initial={{ y: 100, opacity: 0 }}
							transition={{ duration: 0.25, ease: "easeInOut" }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: 100, opacity: 0 }}
							className="btn btn-error rounded-lg uppercase"
							onClick={() => clearPlaylist()}
						>
							Clear
						</motion.button>
					)}
				</AnimatePresence>
			</div>
			<DndContext
				autoScroll={true}
				onDragEnd={handleDragEnd}
				collisionDetection={closestCorners}
			>
				<SortableContext items={sortingCriteria}>
					<div className="flex overflow-y-hidden overflow-x-scroll rounded-lg scrollbar scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm sm:max-w-[90vw]">
						<AnimatePresence>{...playlistArray}</AnimatePresence>
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}

export default PlaylistTrack;
