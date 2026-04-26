import type React from "react";

const platform = typeof __PLATFORM__ !== "undefined" ? __PLATFORM__ : "linux";

export const WindowControls: React.FC = () => {
  if (platform === "darwin") {
    // macOS: real traffic lights are drawn by the OS (titleBarStyle hiddenInset).
    // Reserve space so content doesn't underlap them.
    return <div className="w-[70px] shrink-0 app-region-drag" />;
  }

  const minimize = () => window.API_RENDERER.minimizeWindow();
  const maximize = () => window.API_RENDERER.maximizeWindow();
  const close = () => window.API_RENDERER.closeWindow();

  return (
    <div
      className="flex items-center shrink-0 no-drag"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={minimize}
        aria-label="Minimize"
        className="flex items-center justify-center w-10 h-9 text-base-content/60 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100"
      >
        <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor" aria-hidden>
          <rect width="11" height="1" />
        </svg>
      </button>
      <button
        type="button"
        onClick={maximize}
        aria-label="Maximize"
        className="flex items-center justify-center w-10 h-9 text-base-content/60 hover:text-base-content hover:bg-base-content/8 transition-colors duration-100"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden
        >
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="flex items-center justify-center w-10 h-9 text-base-content/60 hover:text-error hover:bg-error/10 transition-colors duration-100"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="1" y1="1" x2="9" y2="9" />
          <line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </button>
    </div>
  );
};

export default WindowControls;
