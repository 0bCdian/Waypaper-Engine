import type { Monitor } from "../../electron/daemon-go-types";

export function toSeconds(hours: number, minutes: number) {
	return hours * 3600 + minutes * 60;
}

export function toHoursAndMinutes(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return { hours, minutes };
}

export function debounce(callback: () => void, timer = 1000) {
	let previous: ReturnType<typeof window.setTimeout> | undefined;
	return () => {
		if (previous !== undefined) {
			clearTimeout(previous);
		}
		previous = setTimeout(() => {
			callback();
		}, timer);
	};
}

export function parseResolution(resolution: string) {
	const [width, height] = resolution.split("x");
	return { width: parseInt(width, 10), height: parseInt(height, 10) };
}

export function calculateMinResolution(monitors: Monitor[]) {
	let maxWidth = 0;
	let maxHeight = 0;

	for (const monitor of monitors) {
		const effectiveWidth = monitor.width + monitor.x;
		const effectiveHeight = monitor.height + monitor.y;

		if (effectiveWidth > maxWidth) {
			maxWidth = effectiveWidth;
		}

		if (effectiveHeight > maxHeight) {
			maxHeight = effectiveHeight;
		}
	}

	return { x: maxWidth, y: maxHeight };
}
