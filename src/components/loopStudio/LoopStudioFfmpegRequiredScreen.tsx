import { OPTIONAL_RUNTIME_DEPS_DOC } from "./loopStudioHandbookUrls";

type Props = {
  onOpenExternal: (url: string) => void;
};

/**
 * Full-viewport gate when Looper Studio cannot run (ffmpeg drives export, palette, and most video tooling).
 * Documentation link only here — mirrors the Wallhaven “disabled” empty state pattern.
 */
export function LoopStudioFfmpegRequiredScreen({ onOpenExternal }: Props) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-5 px-6 py-10 text-base-content">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -12deg,
            oklch(var(--bc) / 0.22) 0px,
            oklch(var(--bc) / 0.22) 1px,
            transparent 1px,
            transparent 16px
          )`,
        }}
        aria-hidden
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-[1] h-16 w-16 shrink-0 text-base-content/35"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <div className="relative z-[1] max-w-sm space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-base-content/45">
          Loop Studio
        </p>
        <p className="text-lg font-semibold text-base-content">ffmpeg not available</p>
        <p className="text-sm leading-relaxed text-base-content/65">
          Export, palette extraction, and video tooling here need{" "}
          <code className="rounded bg-base-300 px-1 py-px font-mono text-[11px]">ffmpeg</code> on
          your PATH. Install it, then focus this window — we re-check on focus.
        </p>
      </div>
      <button
        type="button"
        className="relative z-[1] btn btn-primary btn-sm rounded-none border-2 border-base-content shadow-[3px_3px_0_0_oklch(var(--bc)/0.18)]"
        onClick={() => onOpenExternal(OPTIONAL_RUNTIME_DEPS_DOC)}
      >
        Documentation
      </button>
    </div>
  );
}
