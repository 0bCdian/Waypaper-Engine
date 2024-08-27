import { useSortable } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useCallback, useState, memo } from "react";
import { type PLAYLIST_TYPES_TYPE } from "../../shared/types/playlist";
import { playlistStore } from "../stores/playlist";
import { type rendererImage } from "../types/rendererTypes";
import { motion } from "framer-motion";
import useDebounceCallback from "../hooks/useDebounceCallback";
const { getThumbnailSrc } = window.API_RENDERER;
let firstRender = true;
const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];
const MiniPlaylistCard = memo(function MiniPlaylistCard({
    Image,
    type,
    index,
    isLast,
    reorderSortingCriteria
}: {
    Image: rendererImage;
    type: PLAYLIST_TYPES_TYPE;
    index: number;
    isLast: boolean;
    reorderSortingCriteria: () => void;
}) {
    const { removeImagesFromPlaylist, playlistImagesTimeSet } = playlistStore();
    const [isInvalid, setIsInvalid] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const timeRef = useRef<HTMLInputElement>(null);
    const imageSrc = useMemo(() => {
        return getThumbnailSrc(Image.name);
    }, [Image]);
    const { attributes, listeners, setNodeRef } = useSortable({
        id: Image.id
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
    const onRemove = useCallback(() => {
        Image.isChecked = false;
        removeImagesFromPlaylist(new Set<number>().add(Image.id));
    }, []);

    const reOrderDebounced = useDebounceCallback(() => {
        reorderSortingCriteria();
    }, 200);
    useEffect(() => {
        if (
            timeRef.current !== null &&
            Image.time !== null &&
            type === "timeofday"
        ) {
            let minutes: string | number = Image.time % 60;
            let hours: string | number = (Image.time - minutes) / 60;
            minutes = minutes < 10 ? "0" + minutes : minutes;
            hours = hours < 10 ? "0" + hours : hours;
            timeRef.current.value = `${hours}:${minutes}`;
        }
    }, [type, Image.time, playlistImagesTimeSet]);

    useEffect(() => {
        if (firstRender) {
            firstRender = false;
            return;
        }
        if (isLast) {
            setTimeout(() => {
                imageRef.current?.scrollIntoView({
                    behavior: "smooth"
                });
            }, 500);
        }
    }, [index]);
    return (
        <motion.div
            layout
            key={Image.id}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.2 }}
            ref={setNodeRef}
        >
            <div className="mx-1 mb-2 w-32 shrink-0 rounded-lg shadow-xl">
                {type === "timeofday" && (
                    <div className="flex max-h-[fit] flex-col">
                        <span
                            className={
                                isInvalid
                                    ? "rounded-md font-semibold italic"
                                    : "opacity-0"
                            }
                        >
                            Invalid time
                        </span>
                        <input
                            type="time"
                            ref={timeRef}
                            className="input input-sm input-bordered mb-2 ml-1 rounded-md invalid:bg-red-800 focus:outline-none"
                            onChange={e => {
                                const stringValue = e.currentTarget.value;
                                const [hours, minutes] = stringValue.split(":");
                                const newTimeSum =
                                    Number(hours) * 60 + Number(minutes);
                                if (playlistImagesTimeSet.has(newTimeSum)) {
                                    e.currentTarget.setCustomValidity(
                                        "invalid time, another image has the same time"
                                    );
                                    setIsInvalid(true);
                                } else {
                                    e.currentTarget.setCustomValidity("");
                                    setIsInvalid(false);
                                    playlistImagesTimeSet.delete(
                                        Image.time ?? -1
                                    );
                                    Image.time = newTimeSum;
                                    playlistImagesTimeSet.add(newTimeSum);
                                    reOrderDebounced();
                                }
                            }}
                        />
                    </div>
                )}
                <span className="h-full text-clip whitespace-nowrap font-bold text-stone-100 shadow-xl">
                    {type === "dayofweek" ? text : undefined}
                </span>
                <div className="relative">
                    <button
                        onClick={onRemove}
                        className="absolute right-0 top-0 cursor-default rounded-md opacity-0 transition-all hover:bg-error hover:opacity-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="#F3D8D2"
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
                    alt={Image.name}
                    className="cursor-default rounded-lg shadow-2xl transition-all active:scale-105 active:opacity-45"
                    ref={imageRef}
                    loading="lazy"
                />
            </div>
        </motion.div>
    );
});

export default MiniPlaylistCard;
