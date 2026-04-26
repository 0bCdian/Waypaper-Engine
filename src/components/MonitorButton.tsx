import type React from "react";
import { useMonitorStore } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { useModalStore } from "../stores/modalStore";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";
import { logger } from "../utils/logger";

export const MonitorButton: React.FC = () => {
  const { monitorSelection, reQueryMonitors } = useMonitorStore(
    useShallow((s) => ({
      monitorSelection: s.monitorSelection,
      reQueryMonitors: s.reQueryMonitors,
    })),
  );
  const isNeo = useIsNeo();

  const handleClick = async () => {
    try {
      await reQueryMonitors();
      useModalStore.getState().open("monitors");
    } catch (error) {
      logger.error("Failed to query monitors:", error);
    }
  };

  const hasMonitors = monitorSelection.selectedMonitors.length > 0;
  const label = hasMonitors ? monitorSelection.selectedMonitors.join(", ") : "Select Display";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Select display monitor"
      title={label}
      className={cn(
        "flex items-center gap-2 px-3 h-7 text-sm font-semibold rounded-lg transition-all duration-150 shrink-0",
        isNeo
          ? "neo-icon-box"
          : hasMonitors
            ? "bg-primary text-primary-content hover:brightness-110 shadow-sm"
            : "bg-base-300 text-base-content hover:bg-primary hover:text-primary-content border border-base-content/15",
      )}
    >
      {/* Monitor icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 shrink-0"
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
      <span className="truncate max-w-48">{label}</span>
      {hasMonitors && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5 shrink-0 opacity-70"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
};

export default MonitorButton;
