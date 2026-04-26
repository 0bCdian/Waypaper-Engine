import type React from "react";
import { useMonitorStore } from "../../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { useModalStore } from "../../stores/modalStore";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";
import { useIsNeo } from "../../hooks/useIsNeo";
import { cn } from "../../utils/cn";
import { logger } from "../../utils/logger";
import WindowControls from "./WindowControls";

const dragRegion: React.CSSProperties = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag: React.CSSProperties = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export const TitleBar: React.FC = () => {
  const { monitorSelection, reQueryMonitors } = useMonitorStore(
    useShallow((s) => ({
      monitorSelection: s.monitorSelection,
      reQueryMonitors: s.reQueryMonitors,
    })),
  );
  const isNeo = useIsNeo();

  const handleMonitorSelect = async () => {
    try {
      await reQueryMonitors();
      useModalStore.getState().open("monitors");
    } catch (error) {
      logger.error("Failed to query monitors:", error);
    }
  };

  return (
    <header
      className="flex items-center h-9 shrink-0 bg-base-100 border-b border-base-300 select-none"
      style={dragRegion}
    >
      {/* Left: sidebar hamburger */}
      <div className="flex items-center" style={noDrag}>
        <label
          htmlFor={DRAWER_CHECKBOX_ID}
          className={cn(
            "flex items-center justify-center w-10 h-9 text-base-content/60 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100 cursor-pointer",
            isNeo && "neo-icon-box",
          )}
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </label>
      </div>

      {/* Center: monitor selector — draggable region around it */}
      <div className="flex-1 flex items-center justify-center" style={dragRegion}>
        <div style={noDrag}>
          <button
            type="button"
            onClick={handleMonitorSelect}
            className={cn(
              "flex items-center gap-1.5 px-3 h-6 text-xs font-medium rounded-md text-base-content/70 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100",
              isNeo && "neo-icon-box",
            )}
            aria-label="Select display monitor"
            title={
              monitorSelection.selectedMonitors.length > 0
                ? monitorSelection.selectedMonitors.join(", ")
                : "Select display"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
              />
            </svg>
            <span className="truncate max-w-48">
              {monitorSelection.selectedMonitors.length > 0
                ? monitorSelection.selectedMonitors.join(", ")
                : "Select Display"}
            </span>
          </button>
        </div>
      </div>

      {/* Right: window controls */}
      <WindowControls />
    </header>
  );
};

export default TitleBar;
