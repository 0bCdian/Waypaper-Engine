import { type objectValues } from "../types";

export const PLAYLIST_ORDER = {
	ordered: "ordered",
	random: "random",
} as const;

export const PLAYLIST_TYPES = {
	TIMER: "timer",
	NEVER: "never",
	MANUAL: "manual",
	TIME_OF_DAY: "time_of_day", // Updated to match new daemon format
	DAY_OF_WEEK: "day_of_week", // Updated to match new daemon format
	// Legacy support
	TIMEOFDAY: "timeofday",
	DAYOFWEEK: "dayofweek",
} as const;

export type PLAYLIST_ORDER_TYPES = objectValues<typeof PLAYLIST_ORDER>;
export type PLAYLIST_TYPES_TYPE = objectValues<typeof PLAYLIST_TYPES>;
