import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import { type monitorSelectType } from "../types/rendererTypes";
import SvgComponent from "./addImagesIcon";
import { useState } from "react";

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
	const { setMonitorsList } = useMonitorStore();
	const [isLoading] = useState(false);

	const scaledWidth = monitor.width * scale;
	const scaledHeight = monitor.height * scale;
	const rectangleStyle: React.CSSProperties = {
		width: scaledWidth,
		height: scaledHeight,
		position: "relative",
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
				className="border-[0.2rem] border-transparent transition-all data-[selected=true]:border-info"
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
