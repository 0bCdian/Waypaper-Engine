import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import type { monitorSelectType } from "../types/rendererTypes";
import SvgComponent from "./addImagesIcon";
import { useState, useEffect, useMemo } from "react";
import { calculateMinResolution } from "../utils/utilities";

const goDaemon = window.API_RENDERER.goDaemon;

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
	monitorsList,
}: props) {
	const setMonitorsList = useMonitorStore((s) => s.setMonitorsList);
	const [wallpaperSrc, setWallpaperSrc] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const fetchWallpaperPreview = () => {
		setIsLoading(true);
		goDaemon
			.getImageHistory(1, monitor.name)
			.then((history) => {
				if (history.length > 0) {
					return goDaemon.getImage(history[0].image_id);
				}
				return null;
			})
			.then((image) => {
				if (image) {
					const src =
						image.thumbnails?.["1080p"] ||
						image.thumbnails?.["720p"] ||
						image.thumbnails?.default ||
						image.path;
					setWallpaperSrc(src);
				}
			})
			.catch((err) => {
				console.warn(`Failed to load wallpaper for ${monitor.name}:`, err);
			})
			.finally(() => {
				setIsLoading(false);
			});
	};

	// Fetch on mount and when monitor changes
	useEffect(() => {
		fetchWallpaperPreview();
	}, []);

	// Re-fetch when a wallpaper changes on any monitor
	useEffect(() => {
		const dispose = goDaemon.on("wallpaper_changed", fetchWallpaperPreview);
		return dispose;
	}, []);

	// For extend mode: compute the image style so each monitor shows its
	// corresponding portion of the wallpaper (like the daemon's image splitter).
	const extendImageStyle = useMemo((): React.CSSProperties | null => {
		if (selectType !== "extend") return null;
		const totalRes = calculateMinResolution(monitorsList);
		if (totalRes.x === 0 || totalRes.y === 0) return null;

		// Scale the full image to cover the entire virtual desktop,
		// then position it so only this monitor's region is visible.
		const scaleX = (totalRes.x / monitor.width) * 100;
		const scaleY = (totalRes.y / monitor.height) * 100;
		const posX =
			totalRes.x > monitor.width
				? (monitor.x / (totalRes.x - monitor.width)) * 100
				: 0;
		const posY =
			totalRes.y > monitor.height
				? (monitor.y / (totalRes.y - monitor.height)) * 100
				: 0;

		return {
			width: "100%",
			height: "100%",
			objectFit: "cover",
			objectPosition: `${posX}% ${posY}%`,
			transform: `scale(${Math.max(scaleX, scaleY) / 100})`,
			transformOrigin: `${posX}% ${posY}%`,
		};
	}, [selectType, monitor, monitorsList]);

	const scaledWidth = monitor.width * scale;
	const scaledHeight = monitor.height * scale;
	const rectangleStyle: React.CSSProperties = {
		width: scaledWidth,
		height: scaledHeight,
		position: "relative",
		overflow: "hidden",
	};
	const imageStyle: React.CSSProperties = {
		width: "100%",
		height: "100%",
		objectFit: "cover",
	};

	return (
		<div
			onClick={() => {
				if (monitorsList.length < 1) return;

				if (selectType === "individual") {
					if (!monitor.isSelected) {
						monitorsList.forEach((otherMonitor) => {
							otherMonitor.isSelected = otherMonitor.name === monitor.name;
						});
					} else {
						monitor.isSelected = false;
					}
				} else if (selectType === "extend" || selectType === "clone") {
					const currentlySelected = monitorsList.filter(
						(m) => m.isSelected,
					).length;

					if (!monitor.isSelected) {
						monitor.isSelected = true;
					} else if (currentlySelected > 2) {
						monitor.isSelected = false;
					}
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
				className="border-[0.2rem] border-transparent transition-colors duration-200 data-[selected=true]:border-info"
			>
				{isLoading ? (
					<div
						className="flex h-full w-full cursor-pointer items-center justify-center bg-base-200/50"
						style={imageStyle}
					>
						<div className="text-center text-base-content/70">
							<div className="loading loading-spinner loading-md"></div>
							<p className="mt-2 text-sm font-medium">Loading...</p>
						</div>
					</div>
				) : wallpaperSrc ? (
					<img
						src={wallpaperSrc}
						alt={`Wallpaper on ${monitor.name}`}
						className="h-full w-full cursor-pointer object-cover"
						style={extendImageStyle ?? imageStyle}
						draggable={false}
					/>
				) : (
					<div
						className="flex h-full w-full cursor-pointer items-center justify-center border-2 border-dashed border-base-300 bg-base-200/50"
						style={imageStyle}
					>
						<div className="text-center text-base-content/70">
							<div className="mx-auto mb-2 h-12 w-12 opacity-50">
								<SvgComponent />
							</div>
							<p className="text-sm font-medium">{monitor.name}</p>
							<p className="text-xs opacity-75">
								{monitor.width}x{monitor.height}
							</p>
						</div>
					</div>
				)}
				<div
					draggable={false}
					className="absolute left-0 top-0 bg-base-content/70 px-2 py-1 md:text-lg xl:text-3xl text-base-100"
				>
					{monitor.name}
				</div>
			</div>
		</div>
	);
}
