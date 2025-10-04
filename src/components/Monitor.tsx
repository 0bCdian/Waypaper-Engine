import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import { type monitorSelectType } from "../types/rendererTypes";
import SvgComponent from "./addImagesIcon";
import { useEffect, useState } from "react";

interface props {
    monitor: StoreMonitor;
    scale: number;
    selectType: monitorSelectType;
    monitorsList: StoreMonitor[];
}

export function MonitorComponent({
    monitor,
    scale,
    selectType,
    monitorsList
}: props) {
    const { setMonitorsList, activeMonitor } = useMonitorStore();
    const [monitorImagePath, setMonitorImagePath] = useState<string | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(false);

    const scaledWidth = monitor.width * scale;
    const scaledHeight = monitor.height * scale;
    const rectangleStyle: React.CSSProperties = {
        width: scaledWidth,
        height: scaledHeight,
        position: "relative"
    };
    const imageStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        objectFit: "cover"
    };

    // Load monitor-specific image when in extend mode
    useEffect(() => {
        const loadMonitorImage = async () => {
            if (!monitor.currentImage) {
                setMonitorImagePath(null);
                return;
            }

            // In extend mode, get the monitor-specific image
            if (
                activeMonitor.extendAcrossMonitors &&
                activeMonitor.monitors.length > 1
            ) {
                setIsLoading(true);
                try {
                    const imagePath =
                        await window.API_RENDERER.goDaemon.getMonitorImage(
                            monitor.name
                        );
                    setMonitorImagePath(imagePath);
                } catch (error) {
                    console.error(
                        "Failed to load monitor-specific image:",
                        error
                    );
                    // Fall back to empty path - let the image src handle the fallback
                    setMonitorImagePath(null);
                } finally {
                    setIsLoading(false);
                }
            } else {
                // In individual mode, get the image path from Electron (which handles atom:// protocol)
                try {
                    const imagePath =
                        await window.API_RENDERER.goDaemon.getImageSrc(
                            monitor.currentImage
                        );
                    setMonitorImagePath(imagePath);
                } catch (error) {
                    console.error(
                        "Failed to get image path from Electron:",
                        error
                    );
                    // Fall back to empty path - let the image src handle the fallback
                    setMonitorImagePath(null);
                }
            }
        };

        loadMonitorImage();
    }, [
        monitor.currentImage,
        monitor.name,
        activeMonitor.extendAcrossMonitors,
        activeMonitor.monitors.length
    ]);
    return (
        <div
            onClick={() => {
                if (monitorsList.length < 1) return;
                monitor.isSelected = !monitor.isSelected;
                if (selectType === "individual") {
                    monitorsList.forEach(otherMonitor => {
                        if (otherMonitor.name !== monitor.name) {
                            otherMonitor.isSelected = false;
                        }
                    });
                }
                setMonitorsList([...monitorsList]);
            }}
            className="relative select-none rounded-lg"
            draggable={false}
        >
            <div
                draggable={false}
                data-selected={monitor.isSelected}
                style={rectangleStyle}
                className="border-[0.2rem] border-transparent transition-all data-[selected=true]:border-info"
            >
                {monitor.currentImage ? (
                    isLoading ? (
                        <div
                            className="flex h-full w-full cursor-pointer items-center justify-center bg-base-200/50"
                            style={imageStyle}
                        >
                            <div className="text-center text-base-content/70">
                                <div className="loading loading-spinner loading-md"></div>
                                <p className="mt-2 text-sm font-medium">
                                    Loading...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <img
                            data-selected={monitor.isSelected}
                            draggable={false}
                            src={monitorImagePath || ""}
                            alt="Monitor"
                            style={imageStyle}
                            className="transform-gpu cursor-pointer"
                        />
                    )
                ) : (
                    <div
                        className="flex h-full w-full cursor-pointer items-center justify-center border-2 border-dashed border-base-300 bg-base-200/50"
                        style={imageStyle}
                    >
                        <div className="text-center text-base-content/70">
                            <div className="mx-auto mb-2 h-12 w-12 opacity-50">
                                <SvgComponent />
                            </div>
                            <p className="text-sm font-medium">
                                No wallpaper set
                            </p>
                            <p className="text-xs opacity-75">
                                Click to set one
                            </p>
                        </div>
                    </div>
                )}
                <div
                    draggable={false}
                    className="absolute left-0 top-0 bg-black bg-opacity-70 px-2 py-1 md:text-lg xl:text-3xl"
                >
                    {monitor.name}
                </div>
            </div>
        </div>
    );
}
