import { OPTIONAL_RUNTIME_DEPS_DOC } from "./loopStudioHandbookUrls";

type Props = {
  onOpenExternal: (url: string) => void;
};

export function LoopStudioYtDlpBanner({ onOpenExternal }: Props) {
  return (
    <div
      className="relative z-[2] flex shrink-0 items-start gap-3 border-[var(--wp-border-w)] border-warning/40 bg-warning/10 px-3 py-2.5 sm:px-4 rounded-[var(--wp-radius-md)] shadow-[var(--wp-elev-1,none)]"
      role="status"
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-warning"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
      <div className="min-w-0 flex-1 space-y-1 text-xs sm:text-sm">
        <p className="font-semibold text-warning">yt-dlp not found</p>
        <p className="leading-snug text-base-content/80">
          YouTube URLs need{" "}
          <code className="rounded bg-base-300/80 px-1 py-px font-mono text-[11px]">yt-dlp</code> on
          PATH. Local files and gallery clips still work.{" "}
          <button
            type="button"
            className="link link-hover font-semibold text-warning"
            onClick={() => onOpenExternal(OPTIONAL_RUNTIME_DEPS_DOC)}
          >
            Documentation
          </button>
        </p>
      </div>
    </div>
  );
}
