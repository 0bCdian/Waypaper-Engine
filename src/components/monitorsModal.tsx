import { useEffect, useRef, useState, memo } from "react";
import { useMonitorStore, type MonitorSelection } from "../stores/monitors";
import { MonitorComponent } from "./Monitor";
import { calculateMinResolution } from "../utils/utilities";
import { type monitorSelectType } from "../types/rendererTypes";
import type { Monitor } from "../../electron/daemon-go-types";
import { playlistStore } from "../stores/playlist";

const goDaemon = window.API_RENDERER.goDaemon;
let firstRender = true;

const Monitors = memo(function Monitors() {
	const {
		monitorSelection,
		monitorsList,
		setMonitorsList,
		setMonitorSelection,
		reQueryMonitors,
	} = useMonitorStore();

	const { clearPlaylist } = playlistStore();

	const initialSelectState: monitorSelectType = monitorSelection.mode || "individual";
	const [selectType, setSelectType] =
		useState<monitorSelectType>(initialSelectState);

	useEffect(() => {
		if (monitorSelection.mode !== selectType) {
			setSelectType(monitorSelection.mode);
		}
	}, [monitorSelection.mode]);

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
		const selectedMonitors: string[] = [];
		monitorsList.forEach((monitor) => {
			if (!monitor.isSelected) return;
			selectedMonitors.push(monitor.name);
		});

		if (selectedMonitors.length === 0) {
			setError({ state: true, message: "Select at least one display" });
			setTimeout(() => {
				setError((prev) => ({ ...prev, state: false }));
			}, 3000);
			return;
		}

		if (selectType === "individual" && selectedMonitors.length > 1) {
			setError({
				state: true,
				message: "Cannot select more than one display in this mode",
			});
			setTimeout(() => {
				setError((prev) => ({ ...prev, state: false }));
			}, 3000);
			return;
		}

		if (
			(selectType === "clone" || selectType === "extend") &&
			selectedMonitors.length < 2
		) {
			setError({ state: true, message: "Select at least two displays" });
			setTimeout(() => {
				setError((prev) => ({ ...prev, state: false }));
			}, 3000);
			return;
		}

		const newSelection: MonitorSelection = {
			selectedMonitors,
			mode: selectType,
		};

		closeModal();
		setMonitorSelection(newSelection);
		clearPlaylist();
	};

	const scale =
		1 / ((monitorsList.length + 1) * (screen.availWidth / window.innerWidth));
	const modalRef = useRef<HTMLDialogElement>(null);

	const setModalRef = (element: HTMLDialogElement | null) => {
		Object.assign(modalRef, { current: element });
		if (element) {
			window.monitors = {
				showModal: () => element.showModal(),
				closeModal: () => element.close(),
				close: () => element.close(),
			};
		} else {
			if (window.monitors) {
				window.monitors = undefined;
			}
		}
	};

	useEffect(() => {
		return () => {};
	}, []);

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

	useEffect(() => {
		void reQueryMonitors();
	}, []);

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
	}, [selectType]);

	useEffect(() => {
		if (!firstRender) return;
		firstRender = false;

		goDaemon.on("monitor_connected", () => {
			setTimeout(() => {
				void reQueryMonitors().then(() => {
					window.monitors?.showModal();
				});
			}, 300);
		});

		goDaemon.on("monitor_disconnected", () => {
			setTimeout(() => {
				void reQueryMonitors();
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
								const left = isSingleMonitor ? 0 : monitor.x * scale;
								const top = isSingleMonitor ? 0 : monitor.y * scale;

								return (
									<div
										draggable={false}
										style={{
											position: "absolute",
											left,
											top,
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
