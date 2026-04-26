import type React from "react";
import { Link } from "react-router-dom";
import { useMonitorStore } from "../../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { useModalStore } from "../../stores/modalStore";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";
import { useIsNeo } from "../../hooks/useIsNeo";
import { cn } from "../../utils/cn";
import { logger } from "../../utils/logger";

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

  const hasMonitors = monitorSelection.selectedMonitors.length > 0;
  const monitorLabel = hasMonitors
    ? monitorSelection.selectedMonitors.join(", ")
    : "Select Display";

  return (
    <header
      className="flex items-center h-9 shrink-0 bg-base-100 border-b border-base-300 select-none"
      style={dragRegion}
    >
      {/* Left: home link on desktop / drawer toggle on mobile */}
      <div className="flex items-center" style={noDrag}>
        {/* Desktop: app logo → gallery */}
        <Link
          to="/"
          className={cn(
            "hidden min-[800px]:flex items-center justify-center w-10 h-9 text-base-content/60 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100",
            isNeo && "neo-icon-box",
          )}
          aria-label="Go to Gallery"
          title="Gallery"
        >
          <img
            src={`${import.meta.env.BASE_URL}app.png`}
            alt=""
            className="w-5 h-5 object-contain"
            aria-hidden
          />
        </Link>

        {/* Mobile: hamburger drawer toggle */}
        <label
          htmlFor={DRAWER_CHECKBOX_ID}
          className={cn(
            "flex min-[800px]:hidden items-center justify-center w-10 h-9 text-base-content/60 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100 cursor-pointer",
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

      {/* Center: prominent monitor selector */}
      <div className="flex-1 flex items-center justify-center" style={dragRegion}>
        <div style={noDrag}>
          <button
            type="button"
            onClick={handleMonitorSelect}
            className={cn(
              "flex items-center gap-2 px-3 h-7 text-sm font-semibold rounded-lg transition-all duration-150",
              isNeo
                ? "neo-icon-box"
                : hasMonitors
                  ? "bg-primary text-primary-content hover:brightness-110 shadow-sm"
                  : "bg-base-300 text-base-content hover:bg-primary hover:text-primary-content border border-base-content/15",
            )}
            aria-label="Select display monitor"
            title={monitorLabel}
          >
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
            <span className="truncate max-w-56">{monitorLabel}</span>
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
        </div>
      </div>

      {/* Right: intentionally empty — no window controls (WM handles decorations) */}
      <div className="w-10 shrink-0" />
    </header>
  );
};

export default TitleBar;
