import { useSortable } from "@dnd-kit/react/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PLAYLIST_TYPES_TYPE } from "../../shared/types/playlist";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useMonitorStore } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import useDebounceCallback from "../hooks/useDebounceCallback";
import type { PlaylistImage } from "../../electron/daemon-go-types";
import type { DragSourceData } from "../stores/dragStore";
import { useDesignSystemStore } from "../stores/designSystemStore";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { buildPlaylistCardMenuItems } from "../utils/contextMenuItems";

const daysOfWeek = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function formatTime(totalMinutes: number): string {
	const minutes = totalMinutes % 60;
	const hours = (totalMinutes - minutes) / 60;
	const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
	const hh = hours < 10 ? `0${hours}` : `${hours}`;
	return `${hh}:${mm}`;
}

function MiniPlaylistCard({
	playlistImage,
	type,
	index,
	isLast,
	reorderSortingCriteria,
}: {
	playlistImage: PlaylistImage;
	type: PLAYLIST_TYPES_TYPE;
	index: number;
	isLast: boolean;
	reorderSortingCriteria: () => void;
}) {
	const { removeImagesFromPlaylist, playlistImagesTimeSet, updateImageTime } =
		usePlaylistStore(
			useShallow((s) => ({
				removeImagesFromPlaylist: s.removeImagesFromPlaylist,
				playlistImagesTimeSet: s.playlistImagesTimeSet,
				updateImageTime: s.updateImageTime,
			})),
		);
	const imagesMap = useImagesStore((s) => s.imagesMap);
	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);
	const openContextMenu = useContextMenuStore((s) => s.open);
	const monitorsList = useMonitorStore((s) => s.monitorsList);
	const [isInvalid, setIsInvalid] = useState(false);
	const [localTime, setLocalTime] = useState(() =>
		playlistImage.time != null ? formatTime(playlistImage.time) : "00:00",
	);
	const imageRef = useRef<HTMLImageElement>(null);

	const imageInfo = imagesMap.get(playlistImage.image_id);
	const imageName = imageInfo?.name || `Image #${playlistImage.image_id}`;
	const imageSrc =
		imageInfo?.thumbnails?.default ||
		imageInfo?.thumbnails?.["720p"] ||
		imageInfo?.path ||
		undefined;

	const sortableData = useMemo<DragSourceData>(
		() => ({ type: "playlist-item", imageId: playlistImage.image_id }),
		[playlistImage.image_id],
	);
	const { ref: sortableRef, isDragging } = useSortable({
		id: playlistImage.image_id,
		index,
		data: sortableData,
	});

	let text: string;
	if (isLast === undefined) {
		if (index < 6) {
			text = `${daysOfWeek[index]}-Sunday`;
		} else {
			text = daysOfWeek[index];
		}
	} else {
		text = daysOfWeek[index];
	}

	const onRemove = () => {
		removeImagesFromPlaylist(new Set<number>().add(playlistImage.image_id));
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		const items = buildPlaylistCardMenuItems(
			playlistImage,
			imageName,
			playlistImage.image_id,
			monitorsList,
		);
		openContextMenu(e, items);
	};

	const reOrderDebounced = useDebounceCallback(() => {
		reorderSortingCriteria();
	}, 200);

	// Sync local time from store when the store value changes (e.g. after reorder)
	useEffect(() => {
		if (playlistImage.time != null && type === "time_of_day") {
			setLocalTime(formatTime(playlistImage.time));
			setIsInvalid(false);
		}
	}, [type, playlistImage.time]);

	const commitTime = useCallback(() => {
		if (!localTime) return;
		const [hours, minutes] = localTime.split(":");
		const newTimeSum = Number(hours) * 60 + Number(minutes);
		if (
			playlistImagesTimeSet.has(newTimeSum) &&
			newTimeSum !== playlistImage.time
		) {
			setIsInvalid(true);
		} else {
			setIsInvalid(false);
			if (newTimeSum !== playlistImage.time) {
				updateImageTime(
					playlistImage.image_id,
					playlistImage.time ?? undefined,
					newTimeSum,
				);
				reOrderDebounced();
			}
		}
	}, [
		localTime,
		playlistImagesTimeSet,
		playlistImage.time,
		playlistImage.image_id,
		updateImageTime,
		reOrderDebounced,
	]);

	const isFirstRender = useRef(true);
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		if (isLast) {
			setTimeout(() => {
				imageRef.current?.scrollIntoView({
					behavior: "smooth",
				});
			}, 500);
		}
	}, [isLast]);

	const hasCaption = type === "time_of_day" || type === "day_of_week";

	const cardClass = isNeo
		? "mx-1 mb-2 w-28 sm:w-32 md:w-40 lg:w-44 xl:w-48 shrink-0 neo-mini-card"
		: "mx-1 mb-2 w-28 sm:w-32 md:w-40 lg:w-44 xl:w-48 shrink-0 rounded-lg shadow-xl";

	const imgClass = isNeo
		? `w-full aspect-[3/2] object-cover cursor-default transition-all active:scale-105 active:opacity-45${hasCaption ? "" : " rounded-none"}`
		: `w-full aspect-[3/2] object-cover cursor-default transition-all active:scale-105 active:opacity-45${hasCaption ? " rounded-t-lg" : " rounded-lg shadow-2xl"}`;

	const removeButton = isNeo ? (
		<button
			type="button"
			onClick={onRemove}
			className="neo-remove-btn"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<title>Remove</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	) : (
		<button
			type="button"
			onClick={onRemove}
			className="absolute right-0 top-0 cursor-default rounded-md opacity-0 transition-all hover:bg-error hover:opacity-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className="h-5 w-5 stroke-error-content"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="3"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	);

	const captionClass = isNeo
		? "px-1.5 py-1.5 flex flex-col items-center gap-0.5"
		: "px-1.5 py-1.5 flex flex-col items-center gap-0.5 bg-base-200/60 rounded-b-lg";

	return (
		<motion.div
			layout="position"
			key={playlistImage.image_id}
			transition={{ duration: 0.15, ease: "easeOut" }}
			ref={sortableRef}
		>
			<div className={`${cardClass}${isDragging ? " opacity-50" : ""}`} onContextMenu={handleContextMenu}>
				{/* Neo: button sits on the card (overflow:visible), image is clipped separately */}
				{isNeo && removeButton}
				<div className={isNeo ? "overflow-hidden" : "relative"}>
					{/* Non-neo: button inside the relative wrapper */}
					{!isNeo && removeButton}
					<img
						src={imageSrc}
						alt={imageName}
						className={imgClass}
						ref={imageRef}
						loading="lazy"
					/>
				</div>

				{/* Polaroid-style caption below the image */}
				{type === "time_of_day" && (
					<div className={captionClass}>
						<input
							type="time"
							value={localTime}
							className="input input-xs w-full text-center invalid:bg-error focus:outline-hidden"
							onChange={(e) => setLocalTime(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.currentTarget.blur();
								}
							}}
							onBlur={commitTime}
						/>
						{isInvalid && (
							<span className="text-[0.6rem] font-semibold italic text-error leading-tight">
								Duplicate time
							</span>
						)}
					</div>
				)}
				{type === "day_of_week" && (
					<div className={captionClass}>
						<span className="w-full truncate text-center text-[0.65rem] font-bold uppercase tracking-wide text-base-content">
							{text}
						</span>
					</div>
				)}
			</div>
		</motion.div>
	);
}

export default MiniPlaylistCard;
