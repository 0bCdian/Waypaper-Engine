import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import { type monitorSelectType } from "../types/rendererTypes";

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
    const { setMonitorsList } = useMonitorStore();
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
                <img
                    data-selected={monitor.isSelected}
                    draggable={false}
                    src={`atom://${monitor.currentImage}`}
                    alt="Monitor"
                    style={imageStyle}
                    className="transform-gpu cursor-pointer"
                />
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
