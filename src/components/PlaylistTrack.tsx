import { DndContext, type DragEndEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { useEffect, useRef } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import openImagesStore from "../hooks/useOpenImages";
import { useShallow } from "zustand/react/shallow";
import { AnimatePresence } from "framer-motion";
import { useMonitorStore } from "../stores/monitors";
import type { openFileAction } from "../../shared/types";
import { useSetLastActivePlaylist } from "../hooks/useSetLastActivePlaylist";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import { useDesignSystemStore } from "../stores/designSystemStore";

const { goDaemon } = window.API_RENDERER;
import MiniPlaylistCard from "./MiniPlaylistCard";

function PlaylistTrack() {
	const {
		playlist,
		lastAddedImageID,
		isDirty,
		movePlaylistArrayOrder,
		clearPlaylist,
		setPlaylist,
		swapImageTimes,
	} = usePlaylistStore(
		useShallow((s) => ({
			playlist: s.playlist,
			lastAddedImageID: s.lastAddedImageID,
			isDirty: s.isDirty,
			movePlaylistArrayOrder: s.movePlaylistArrayOrder,
			clearPlaylist: s.clearPlaylist,
			setPlaylist: s.setPlaylist,
			swapImageTimes: s.swapImageTimes,
		})),
	);
	const monitorSelection = useMonitorStore((s) => s.monitorSelection);
	const { openImages, isActive } = openImagesStore(
		useShallow((s) => ({
			openImages: s.openImages,
			isActive: s.isActive,
		})),
	);
	useSetLastActivePlaylist();
	const isFirstRender = useRef(true);

	const handleClickAddImages = (action: openFileAction) => {
		console.log("handleClickAddImages", action);
		void openImages({ action });
	};

	const reorderSortingCriteria = () => {
		const currentImages = usePlaylistStore.getState().playlist.images;
		const newArray = [...currentImages].sort(
			(a: PlaylistImage, b: PlaylistImage) => {
				if (a.time == null || b.time == null) return 0;
				return a.time - b.time;
			},
		);
		movePlaylistArrayOrder(newArray);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { over, active } = event;
		if (over === null) return;
		if (over.id !== active.id) {
			const oldindex = playlist.images.findIndex(
				(element) => element.image_id === active.id,
			);
			const newIndex = playlist.images.findIndex(
				(element) => element.image_id === over?.id,
			);

			swapImageTimes(active.id as number, over.id as number);

			if (playlist.configuration.type === "time_of_day") {
				reorderSortingCriteria();
				return;
			}
			const newArrayOrder = arrayMove(playlist.images, oldindex, newIndex);
			movePlaylistArrayOrder(newArrayOrder);
		}
	};

	const lastIndex = playlist.images.length - 1;
	const sortingCriteria: number[] = [];
	const playlistArray = playlist.images.map((img, index) => {
		const isLast =
			playlist.configuration.type === "time_of_day"
				? lastAddedImageID === img.image_id
				: index === lastIndex;
		sortingCriteria.push(img.image_id);
		return (
			<MiniPlaylistCard
				key={img.image_id}
				isLast={isLast}
				reorderSortingCriteria={reorderSortingCriteria}
				type={playlist.configuration.type}
				index={index}
				playlistImage={img}
			/>
		);
	});

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		if (playlist.images.length === 0) {
			clearPlaylist();
		}
	}, [playlist.images, clearPlaylist]);

	useEffect(() => {
		const dispose = goDaemon.on("playlists_updated", () => {
			if (playlist.id) {
				goDaemon.getPlaylist(playlist.id).then((fullPlaylist) => {
					if (fullPlaylist) {
						setPlaylist({
							id: fullPlaylist.id,
							name: fullPlaylist.name,
							configuration: fullPlaylist.configuration,
							images: fullPlaylist.images,
						});
						void useImagesStore
							.getState()
							.fetchMissingImages(
								fullPlaylist.images.map((img) => img.image_id),
							);
					}
				});
			}
		});
		return dispose;
	}, [playlist.id, setPlaylist]);

	useEffect(() => {
		if (playlist.configuration.type === "time_of_day") {
			reorderSortingCriteria();
		}
	}, [playlist.configuration.type]);

	const imagesMap = useImagesStore((s) => s.imagesMap);
	useEffect(() => {
		if (playlist.images.length === 0) return;
		const missing = playlist.images.filter(
			(img) => !imagesMap.has(img.image_id),
		);
		if (missing.length > 0) {
			void useImagesStore
				.getState()
				.fetchMissingImages(missing.map((img) => img.image_id));
		}
	}, [playlist.images, imagesMap]);

	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);
	const btnClass = isNeo
		? "btn btn-primary uppercase"
		: "btn btn-primary rounded-lg uppercase";
	const scrollClass = playlistArray.length > 0
		? isNeo
			? "neo-playlist-scroll overflow-y-hidden overflow-x-scroll scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm"
			: "overflow-y-hidden overflow-x-scroll scrollbar-thumb-base-300 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm rounded-lg"
		: "";

	return (
		<div className="mb-2 flex w-full min-w-0 flex-col gap-5 overflow-hidden">
			<div className="flex flex-wrap items-center gap-2 lg:gap-3">
			<div className="flex w-full min-w-0 flex-col">
				<span className="text-2xl lg:text-4xl font-bold truncate">
					{playlistArray.length > 0
						? `Playlist (${playlistArray.length})`
						: "Playlist"}
					{isDirty && (
						<span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-warning align-middle" title="Unsaved changes" />
					)}
				</span>
			</div>
	<div className="dropdown dropdown-top">
			<button
				tabIndex={0}
				className={btnClass}
			>
				Add images
			</button>
			<ul className="menu dropdown-content z-10 mb-1 w-52 bg-base-100 p-2 shadow-sm">
					<li>
						<a
							className="text-lg text-base-content"
							onMouseDown={
								isActive ? undefined : () => handleClickAddImages("file")
							}
						>
							Individual images
						</a>
					</li>
					<li>
						<a
							className="text-lg text-base-content"
							onMouseDown={
								isActive ? undefined : () => handleClickAddImages("folder")
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
					className={btnClass}
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
					className={btnClass}
				>
					Random Image
				</button>

		{playlist.images.length > 1 && (
				<>
					<button
						onClick={() => {
							// @ts-expect-error daisyui fix
							window.savePlaylistModal.showModal();
						}}
						className={isDirty ? `${btnClass} btn-warning animate-pulse` : btnClass}
					>
						{isDirty ? "Save*" : "Save"}
					</button>
					<button
						onClick={() => {
							// @ts-expect-error daisyui fix
							window.playlistConfigurationModal.showModal();
						}}
						className={btnClass}
					>
						Configure
					</button>
					<button
						className={isNeo ? "btn btn-error uppercase" : "btn btn-error rounded-lg uppercase"}
						onClick={async () => {
							if (playlist.id) {
								try {
									await goDaemon.stopPlaylist(playlist.id);
								} catch {
									// Playlist may not be running
								}
							}
							clearPlaylist();
						}}
					>
						Clear
					</button>
				</>
			)}
			</div>
			<DndContext
				autoScroll={true}
				onDragEnd={handleDragEnd}
				collisionDetection={closestCorners}
			>
				<SortableContext items={sortingCriteria}>
					<div className={`flex w-full ${scrollClass}`}>
						<AnimatePresence>{...playlistArray}</AnimatePresence>
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}

export default PlaylistTrack;
