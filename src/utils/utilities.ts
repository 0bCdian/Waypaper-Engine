import { type ActiveMonitor, type Monitor } from "../../shared/types/monitor";

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
        const effectiveWidth = monitor.width + monitor.position.x;
        const effectiveHeight = monitor.height + monitor.position.y;

        if (effectiveWidth > maxWidth) {
            maxWidth = effectiveWidth;
        }

        if (effectiveHeight > maxHeight) {
            maxHeight = effectiveHeight;
        }
    }

    return { x: maxWidth, y: maxHeight };
}

export const monitorsListTest = [
    {
        name: "eDP-1",
        width: 3840,
        height: 2160,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 0,
            y: 0
        }
    },
    {
        name: "HDMI-A-1",
        width: 3840,
        height: 2160,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 3840,
            y: 0
        }
    },
    {
        name: "HDMI-A-12",
        width: 3840,
        height: 2160,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 3840,
            y: 2160
        }
    },
    {
        name: "HDMI-b-12",
        width: 2160,
        height: 3840,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 7680,
            y: 0
        }
    }
];

export const monitors1080p = [
    {
        name: "eDP-1",
        width: 1920,
        height: 1080,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 0,
            y: 0
        }
    },
    {
        name: "HDMI-A-1",
        width: 1920,
        height: 1080,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 1920,
            y: 0
        }
    },
    {
        name: "HDMI-A-12",
        width: 1920,
        height: 1080,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 1920,
            y: 1080
        }
    },
    {
        name: "HDMI-b-12",
        width: 1080,
        height: 1920,
        currentImage: "/home/obsy/.waypaper_engine/images/wall2.png",
        position: {
            x: 3840,
            y: 0
        }
    }
];

export function verifyOldMonitorConfigValidity({
    oldConfig,
    monitorsList
}: {
    oldConfig: ActiveMonitor;
    monitorsList: Monitor[];
}): boolean {
    let isValid = true;
    for (let idx = 0; idx < oldConfig.monitors.length; idx++) {
        const oldMonitorName = oldConfig.monitors[idx].name;
        const foundMonitor = monitorsList.find(
            ({ name }) => name === oldMonitorName
        );
        if (foundMonitor === undefined) {
            isValid = false;
            break;
        }
    }
    return isValid;
}
