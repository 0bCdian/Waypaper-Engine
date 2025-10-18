import { useEffect, useRef, useState, memo } from "react";
import { useMonitorStore } from "../stores/monitors";
import { MonitorComponent } from "./Monitor";
import { calculateMinResolution } from "../utils/utilities";
import { type monitorSelectType } from "../types/rendererTypes";
import { type Monitor } from "../../shared/types/monitor";
import { playlistStore } from "../stores/playlist";
const goDaemon = window.API_RENDERER.goDaemon;
let firstRender = true;
const Monitors = memo(function Monitors() {
	const {
		activeMonitor,
		monitorsList,
		setMonitorsList,
		setActiveMonitor,
		reQueryMonitors,
	} = useMonitorStore();
	const { clearPlaylist } = playlistStore();
	let initialSelectState: monitorSelectType = "individual";

	// Use imageSetType from activeMonitor if available, otherwise fallback to legacy logic
	if (
		activeMonitor.imageSetType &&
		["extend", "clone", "individual"].includes(activeMonitor.imageSetType)
	) {
		initialSelectState = activeMonitor.imageSetType as monitorSelectType;
	} else {
		// Legacy fallback logic
		if (activeMonitor.extendAcrossMonitors) {
			initialSelectState = "extend";
		} else if (activeMonitor.monitors.length === 1) {
			initialSelectState = "individual";
		} else if (monitorsList.length > 1) {
			initialSelectState = "clone";
		}
	}
	const [selectType, setSelectType] =
		useState<monitorSelectType>(initialSelectState);

	// Update selectType when activeMonitor changes (e.g., when config is loaded)
	useEffect(() => {
		let newSelectType: monitorSelectType = "individual";

		// Use imageSetType from activeMonitor if available, otherwise fallback to legacy logic
		if (
			activeMonitor.imageSetType &&
			["extend", "clone", "individual"].includes(activeMonitor.imageSetType)
		) {
			newSelectType = activeMonitor.imageSetType as monitorSelectType;
		} else {
			// Legacy fallback logic
			if (activeMonitor.extendAcrossMonitors) {
				newSelectType = "extend";
			} else if (activeMonitor.monitors.length === 1) {
				newSelectType = "individual";
			} else if (monitorsList.length > 1) {
				newSelectType = "clone";
			}
		}

		// Only update if it's different to avoid unnecessary re-renders
		if (newSelectType !== selectType) {
			setSelectType(newSelectType);
		}
	}, [activeMonitor, monitorsList.length]);
	const [error, setError] = useState<{ state: boolean; message: string }>({
		state: false,
		message: "error",
	});
	const closeModal = () => {
		if (modalRef.current) {
			modalRef.current.close();
		}
	};
	const [resolution, setResolution] = useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	const onSubmit = async () => {
		let name: string = "";
		const selectedMonitors: Monitor[] = [];
		monitorsList.forEach((monitor) => {
			if (!monitor.isSelected) return;
			name = name.concat(monitor.name, ",");
			// eslint-disable-next-line no-unused-vars
			const { isSelected, ...selectedMonitor } = monitor;
			selectedMonitors.push(selectedMonitor);
		});
		if (selectedMonitors.length === 0) {
			setError({ state: true, message: "Select at least one display" });
			setTimeout(() => {
				setError((prevError) => {
					return { ...prevError, state: false };
				});
			}, 3000);
			return;
		}
		if (selectType === "individual" && selectedMonitors.length > 1) {
			setError({
				state: true,
				message: "Cannot select more than one display in this mode",
			});
			setTimeout(() => {
				setError((prevError) => {
					return { ...prevError, state: false };
				});
			}, 3000);
			return;
		}
		if (
			(selectType === "clone" || selectType === "extend") &&
			selectedMonitors.length < 2
		) {
			setError({ state: true, message: "Select at least two displays" });
			setTimeout(() => {
				setError((prevError) => {
					return { ...prevError, state: false };
				});
			}, 3000);
			return;
		}
		name = name.slice(0, name.length - 1);
		const activeMonitorConfig = {
			name,
			monitors: selectedMonitors,
			extendAcrossMonitors: selectType === "extend",
			imageSetType: selectType, // Send the actual mode: "extend", "clone", or "individual"
		};

		await goDaemon.setSelectedMonitor(activeMonitorConfig);
		// Close modal FIRST before updating state to prevent re-render issues
		closeModal();
		// Update state after closing modal
		setActiveMonitor(activeMonitorConfig);
		clearPlaylist();
	};
	const scale =
		1 / ((monitorsList.length + 1) * (screen.availWidth / window.innerWidth));
	const modalRef = useRef<HTMLDialogElement>(null);

	// Callback ref to ensure the modal is exposed as soon as it's available
	const setModalRef = (element: HTMLDialogElement | null) => {
		// Use Object.assign to update the ref
		Object.assign(modalRef, { current: element });
		if (element) {
			// Expose the modal with showModal method
			window.monitors = {
				showModal: () => {
					element.showModal();
				},
				closeModal: () => {
					element.close();
				},
				close: () => {
					element.close();
				},
			};
		} else {
			// Clear the window.monitors reference when element is null
			if (window.monitors) {
				window.monitors = undefined;
			}
		}
	};

	// Debug useEffect to track component lifecycle
	useEffect(() => {
		return () => {
			// Component unmounting
		};
	}, []); // Remove dependency to prevent unnecessary re-renders

	// For single monitor, center it by adjusting the container size and positioning
	const isSingleMonitor = monitorsList.length === 1;
	const styles: React.CSSProperties = {
		width: isSingleMonitor
			? monitorsList[0].width * scale
			: resolution.x * scale,
		height: isSingleMonitor
			? monitorsList[0].height * scale
			: resolution.y * scale,
	};
	useEffect(() => {
		const res = calculateMinResolution(monitorsList);
		setResolution(res);
	}, [monitorsList, screen.availWidth]);

	// Load monitors on mount
	useEffect(() => {
		void reQueryMonitors();
	}, []);

	// Debug: Check if modal element exists
	useEffect(() => {
		// Component mounted
	}, []); // Remove dependency to prevent re-renders

	useEffect(() => {
		if (monitorsList.length < 1) return;
		if (selectType === "individual") {
			const resetMonitors = monitorsList.map((monitor, index) => ({
				...monitor,
				isSelected: index === 0,
			}));
			setMonitorsList(resetMonitors);
		} else {
			const updatedMonitors = monitorsList.map((monitor, index) => ({
				...monitor,
				isSelected: index === 0,
			}));
			setMonitorsList(updatedMonitors);
		}
	}, [selectType]); // Only trigger when selectType changes

	useEffect(() => {
		if (!firstRender) return;
		firstRender = false;

		// Listen for display changes via Go daemon events
		goDaemon.on("displays_changed", () => {
			// this setTimeout is added to circumvent an swww limitation on querying recently inserted monitorsList
			//  which sets currentImage to 00000 instead of the actual cached image
			setTimeout(() => {
				void reQueryMonitors().then(() => {
					// @ts-expect-error daisy-ui
					window.monitors.showModal();
				});
			}, 300);
		});
	}, []);
	return (
		<dialog
			id="monitors"
			className="modal w-full select-none"
			ref={setModalRef}
			draggable={false}
		>
			<div className="modal-box min-w-max">
				<div className="m-auto flex max-w-fit flex-col justify-center">
					<h2 className="select-none py-3 text-center text-4xl font-bold">
						Choose Display
					</h2>
					<div className="form-control">
						<select
							defaultValue={initialSelectState}
							onChange={(e) => {
								setSelectType(e.currentTarget.value as monitorSelectType);
							}}
							className="select w-full max-w-full text-center text-xl"
						>
							<option value={"individual"}>Wallpaper per display</option>
							<option value={"extend"} disabled={monitorsList.length < 2}>
								Stretch single wallpaper
							</option>
							<option value={"clone"} disabled={monitorsList.length < 2}>
								Clone single wallpaper
							</option>
						</select>
						<div className="divider"></div>
						<div style={styles} className="relative m-auto">
							{monitorsList.map((monitor) => {
								// For single monitor, center it at (0,0) regardless of its actual position
								const left = isSingleMonitor ? 0 : monitor.position.x * scale;
								const top = isSingleMonitor ? 0 : monitor.position.y * scale;

								return (
									<div
										draggable={false}
										style={{
											position: "absolute",
											left: left,
											top: top,
										}}
										key={monitor.name}
									>
										<MonitorComponent
											monitorsList={monitorsList}
											monitor={monitor}
											selectType={selectType}
											scale={scale * 0.99}
										/>
									</div>
								);
							})}
						</div>
						<div className="divider"></div>
						<span
							data-error={error.state}
							className="opcacity-0 invisible m-auto mb-4 select-none text-center text-2xl italic text-error transition-all duration-300 data-[error=true]:visible data-[error=true]:opacity-100"
						>
							{error.message}
						</span>

						<button
							onClick={onSubmit}
							className="btn btn-primary btn-wide m-auto rounded-md text-xl"
						>
							Save
						</button>
					</div>
				</div>
			</div>
		</dialog>
	);
});

export default Monitors;
