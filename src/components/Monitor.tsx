import { useMonitorStore, type StoreMonitor } from "../stores/monitors";
import type { monitorSelectType } from "../types/rendererTypes";
import { cn } from "@/utils/cn";
import { WallpaperPreview } from "./WallpaperPreview";
import type { LiveWallpapers } from "../hooks/useLiveWallpapers";

interface props {
  monitor: StoreMonitor;
  scale: number;
  selectType: monitorSelectType;
  monitorsList: StoreMonitor[];
  /** Live per-monitor wallpaper state — fetched once by the modal. */
  live: LiveWallpapers;
}

/**
 * One monitor in the Choose Display modal: the selection chrome (click target,
 * border, name chip) wrapping a {@link WallpaperPreview} that faithfully
 * mirrors what is actually on that display. The `selectType` dropdown drives
 * selection only — never what the preview renders.
 */
export function MonitorComponent({ monitor, scale, selectType, monitorsList, live }: props) {
  const setMonitorsList = useMonitorStore((s) => s.setMonitorsList);

  const scaledWidth = monitor.width * scale;
  const scaledHeight = monitor.height * scale;
  const rectangleStyle: React.CSSProperties = {
    width: scaledWidth,
    height: scaledHeight,
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div
      onClick={() => {
        if (monitorsList.length < 1) return;

        const updatedMonitors = monitorsList.map((m) => {
          if (selectType === "individual") {
            return {
              ...m,
              isSelected: !monitor.isSelected
                ? m.name === monitor.name
                : m.name === monitor.name
                  ? false
                  : m.isSelected,
            };
          }
          if (m.name !== monitor.name) return m;
          const currentlySelected = monitorsList.filter((x) => x.isSelected).length;
          if (!monitor.isSelected) {
            return { ...m, isSelected: true };
          }
          if (currentlySelected > 2) {
            return { ...m, isSelected: false };
          }
          return m;
        });
        setMonitorsList(updatedMonitors);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select monitor ${monitor.name}`}
      className="relative cursor-pointer select-none rounded-lg"
      draggable={false}
    >
      <div
        draggable={false}
        data-selected={monitor.isSelected}
        style={rectangleStyle}
        className="border-[0.2rem] border-transparent transition-colors duration-200 data-[selected=true]:border-info"
      >
        <WallpaperPreview
          image={live.byMonitor.get(monitor.name) ?? null}
          mode={live.mode}
          monitor={monitor}
          monitors={monitorsList}
          loading={live.loading}
          scale={scale}
        />
        <div
          draggable={false}
          className={cn(
            "neo-monitor-chip absolute left-0 top-0 px-2 py-1 md:text-lg xl:text-3xl",
            "bg-base-content/70 font-mono text-base-100",
          )}
        >
          {monitor.name}
        </div>
      </div>
    </div>
  );
}
