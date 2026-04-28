import type { ReactNode } from "react";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";

export type ModalStripedHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * When true (default), default-theme header overlaps the padded modal rim (Load Playlist).
   * Set false for full‑width boxed modals (`p-0`) like the filter cheatsheet.
   */
  bleedInsetDefault?: boolean;
  headerExtraClass?: string;
  titleNeoExtra?: string;
  titleDefaultExtra?: string;
  subtitleNeoExtra?: string;
  subtitleDefaultExtra?: string;
  /** Full class list for neo close chip; defaults to brutal square + offset shadow */
  closeNeoClassName?: string;
};

export function ModalStripedHeader(props: ModalStripedHeaderProps & { onClose: () => void }) {
  const {
    title,
    subtitle,
    onClose,
    bleedInsetDefault = true,
    headerExtraClass,
    titleNeoExtra,
    titleDefaultExtra,
    subtitleNeoExtra,
    subtitleDefaultExtra,
    closeNeoClassName,
  } = props;
  const isNeo = useIsNeo();

  const closeNeoMerged =
    closeNeoClassName ??
    "min-h-12 min-w-12 rounded-none border-4 border-base-content bg-base-100 px-3 text-base-content shadow-[4px_4px_0_0_#000] hover:bg-base-200 active:translate-x-1 active:translate-y-1 active:shadow-none";

  return (
    <header
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 text-left",
        isNeo
          ? "border-b-4 border-base-content bg-secondary px-6 pb-5 pt-6 text-secondary-content md:px-8 md:pb-6 md:pt-8"
          : cn(
              "border-b border-base-300 bg-base-200 px-6 pb-5 pt-6",
              bleedInsetDefault && "-mx-6 -mt-6",
              !bleedInsetDefault && "md:px-10",
            ),
        headerExtraClass,
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <h2
          className={cn(
            "select-none font-bold uppercase leading-none tracking-[-0.02em]",
            isNeo
              ? cn(
                  "font-[family-name:var(--font-display)] text-3xl text-secondary-content md:text-4xl",
                  titleNeoExtra,
                )
              : cn(
                  "font-[family-name:var(--font-display)] text-2xl text-base-content md:text-3xl",
                  titleDefaultExtra,
                ),
          )}
        >
          {title}
        </h2>
        {subtitle !== undefined ? (
          <p
            className={cn(
              "max-w-xl text-sm leading-[1.6] md:text-base",
              isNeo ? "text-secondary-content/95" : "text-base-content/75",
              isNeo ? subtitleNeoExtra : subtitleDefaultExtra,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className={cn(
          "btn shrink-0",
          isNeo
            ? closeNeoMerged
            : "btn-ghost btn-square btn-sm hover:bg-base-300",
        )}
        aria-label="Close"
        onClick={onClose}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </header>
  );
}
