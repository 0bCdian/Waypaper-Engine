import { useEffect, useRef } from "react";
import { daemonClient } from "@/client";
import { useNoBackendStore } from "../stores/noBackendStore";

const DOCS_URL = "https://0bCdian.github.io/Waypaper-Engine/guide/install.html";
const POLL_INTERVAL_MS = 5_000;

export default function NoBackendBanner() {
  const { visible, hide } = useNoBackendStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const check = async () => {
      try {
        const backends = await daemonClient.getBackends();
        if (backends.some((b) => b.available)) {
          hide();
        }
      } catch {
        // daemon not reachable yet — keep banner visible
      }
    };

    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, hide]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="
        flex items-center gap-3 px-4 py-2.5 text-sm
        bg-warning/10 border-b border-warning/30
        [data-design=neobrutalist_&]:bg-warning
        [data-design=neobrutalist_&]:border-b-2
        [data-design=neobrutalist_&]:border-black
        [data-design=neobrutalist_&]:text-black
      "
    >
      <span className="shrink-0 text-warning [data-design=neobrutalist_&]:text-black" aria-hidden>
        ⚠
      </span>
      <span className="flex-1 font-medium text-base-content [data-design=neobrutalist_&]:text-black">
        <strong className="text-warning [data-design=neobrutalist_&]:text-black font-bold">
          No wallpaper backends found.
        </strong>{" "}
        Install at least one backend (awww, hyprpaper, mpvpaper…) to set wallpapers.
      </span>
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          shrink-0 btn btn-xs btn-warning btn-outline font-bold
          [data-design=neobrutalist_&]:rounded-none
          [data-design=neobrutalist_&]:border-2
          [data-design=neobrutalist_&]:border-black
          [data-design=neobrutalist_&]:bg-white
          [data-design=neobrutalist_&]:text-black
          [data-design=neobrutalist_&]:shadow-[2px_2px_0_0_black]
        "
      >
        Install guide ↗
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={hide}
        className="
          shrink-0 btn btn-xs btn-ghost opacity-50 hover:opacity-100
          [data-design=neobrutalist_&]:text-black
          [data-design=neobrutalist_&]:opacity-60
        "
      >
        ✕
      </button>
    </div>
  );
}
