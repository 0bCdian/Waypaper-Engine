import { type Monitor } from "../../electron/daemon-go-types";

export function toMS(hours: number, minutes: number) {
	return hours * 60 * 60 * 1000 + minutes * 60 * 1000;
}

export function toHoursAndMinutes(ms: number) {
	const hours = Math.floor(ms / (60 * 60 * 1000));
	const minutes = Math.floor((ms - hours * 60 * 60 * 1000) / (60 * 1000));
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
	return { width: parseInt(width), height: parseInt(height) };
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
