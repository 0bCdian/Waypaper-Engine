import { useSortable } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import type { PLAYLIST_TYPES_TYPE } from "../../shared/types/playlist";
import { usePlaylistStore } from "../stores/playlist";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import useDebounceCallback from "../hooks/useDebounceCallback";
import type { PlaylistImage } from "../../electron/daemon-go-types";

let firstRender = true;
const daysOfWeek = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

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
	const { removeImagesFromPlaylist, playlistImagesTimeSet } = usePlaylistStore(
		useShallow((s) => ({
			removeImagesFromPlaylist: s.removeImagesFromPlaylist,
			playlistImagesTimeSet: s.playlistImagesTimeSet,
		})),
	);
	const imagesMap = useImagesStore((s) => s.imagesMap);
	const [isInvalid, setIsInvalid] = useState(false);
	const imageRef = useRef<HTMLImageElement>(null);
	const timeRef = useRef<HTMLInputElement>(null);

	// Get the full image info from the store
	const imageInfo = imagesMap.get(playlistImage.image_id);
	const imageName = imageInfo?.name || `Image #${playlistImage.image_id}`;
	const imageSrc =
		imageInfo?.thumbnails?.default ||
		imageInfo?.thumbnails?.["720p"] ||
		imageInfo?.path ||
		"";

	const { attributes, listeners, setNodeRef } = useSortable({
		id: playlistImage.image_id,
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

	const reOrderDebounced = useDebounceCallback(() => {
		reorderSortingCriteria();
	}, 200);

	useEffect(() => {
		if (
			timeRef.current !== null &&
			playlistImage.time != null &&
			type === "time_of_day"
		) {
			let minutes: string | number = playlistImage.time % 60;
			let hours: string | number = (playlistImage.time - minutes) / 60;
			minutes = minutes < 10 ? `0${minutes}` : minutes;
			hours = hours < 10 ? `0${hours}` : hours;
			timeRef.current.value = `${hours}:${minutes}`;
		}
	}, [type, playlistImage.time]);

	useEffect(() => {
		if (firstRender) {
			firstRender = false;
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

	return (
		<motion.div
			layout
			key={playlistImage.image_id}
			initial={{ scale: 0.5 }}
			animate={{ scale: 1 }}
			exit={{ scale: 0 }}
			transition={{ duration: 0.2 }}
			ref={setNodeRef}
		>
			<div className="mx-1 mb-2 w-28 sm:w-32 md:w-40 lg:w-44 xl:w-48 shrink-0 rounded-lg shadow-xl">
				{type === "time_of_day" && (
					<div className="flex max-h-[fit] flex-col">
						<span
							className={
								isInvalid ? "rounded-md font-semibold italic" : "opacity-0"
							}
						>
							Invalid time
						</span>
						<input
							type="time"
							ref={timeRef}
							className="input input-sm mb-2 ml-1 rounded-md invalid:bg-error focus:outline-hidden"
							onChange={(e) => {
								const stringValue = e.currentTarget.value;
								const [hours, minutes] = stringValue.split(":");
								const newTimeSum = Number(hours) * 60 + Number(minutes);
								if (playlistImagesTimeSet.has(newTimeSum)) {
									e.currentTarget.setCustomValidity(
										"invalid time, another image has the same time",
									);
									setIsInvalid(true);
								} else {
									e.currentTarget.setCustomValidity("");
									setIsInvalid(false);
									playlistImagesTimeSet.delete(playlistImage.time ?? -1);
									playlistImage.time = newTimeSum;
									playlistImagesTimeSet.add(newTimeSum);
									reOrderDebounced();
								}
							}}
						/>
					</div>
				)}
				<span className="h-full text-clip whitespace-nowrap font-bold text-base-content shadow-xl">
					{type === "day_of_week" ? text : undefined}
				</span>
				<div className="relative">
					<button
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
				</div>
				<img
					{...attributes}
					{...listeners}
					src={imageSrc}
					alt={imageName}
					className="w-full aspect-[3/2] object-cover cursor-default rounded-lg shadow-2xl transition-all active:scale-105 active:opacity-45"
					ref={imageRef}
					loading="lazy"
				/>
			</div>
		</motion.div>
	);
}

export default MiniPlaylistCard;
