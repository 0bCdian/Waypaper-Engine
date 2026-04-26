import type React from "react";

/**
 * Full-screen loading screen shown while app config loads.
 * Uses only CSS animations (no framer-motion dependency at this render stage).
 */
export const LoadingScreen: React.FC = () => {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-base-100 z-[9999]"
      aria-label="Loading Waypaper Engine"
      role="status"
    >
      <style>{`
        @keyframes wp-breathe {
          0%, 100% { transform: scale(1);   opacity: 0.9; }
          50%       { transform: scale(1.06); opacity: 1;   }
        }
        @keyframes wp-ring-spin {
          from { stroke-dashoffset: 220; }
          to   { stroke-dashoffset: -220; }
        }
        @keyframes wp-ring-fade {
          0%, 100% { opacity: 0.25; }
          50%       { opacity: 0.8;  }
        }
        @keyframes wp-text-in {
          from { opacity: 0; letter-spacing: 0.25em; }
          to   { opacity: 1; letter-spacing: 0.15em; }
        }
        .wp-logo-breathe {
          animation: wp-breathe 2.4s ease-in-out infinite;
        }
        .wp-ring-spin {
          stroke-dasharray: 80 220;
          animation:
            wp-ring-spin 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite,
            wp-ring-fade 2.4s ease-in-out infinite;
          transform-origin: center;
        }
        .wp-text-in {
          animation: wp-text-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
        }
      `}</style>

      {/* Outer ring SVG */}
      <div className="relative flex items-center justify-center">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="absolute"
          aria-hidden
        >
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke="oklch(from var(--color-primary) l c h / 0.18)"
            strokeWidth="1.5"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke="oklch(from var(--color-primary) l c h)"
            strokeWidth="2"
            strokeLinecap="round"
            className="wp-ring-spin"
            style={{ transformBox: "fill-box" }}
          />
        </svg>

        {/* App logo */}
        <div className="wp-logo-breathe relative z-10 w-16 h-16 flex items-center justify-center">
          <img
            src={`${import.meta.env.BASE_URL}app.png`}
            alt="Waypaper Engine"
            className="w-14 h-14 object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* App name */}
      <p
        className="wp-text-in mt-8 text-sm font-semibold tracking-[0.15em] uppercase text-base-content/50"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Waypaper Engine
      </p>
    </div>
  );
};

export default LoadingScreen;
