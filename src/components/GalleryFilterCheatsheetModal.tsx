import { useEffect, useRef } from "react";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { GALLERY_FILTER_CHEATSHEET_CARDS } from "../utils/galleryFilterCheatsheetContent";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";

const badgeClass: Record<
  (typeof GALLERY_FILTER_CHEATSHEET_CARDS)[number]["badgeVariant"],
  string
> = {
  primary: "badge badge-primary border-0 font-mono font-bold",
  secondary: "badge badge-secondary border-0 font-mono font-bold text-secondary-content",
  accent: "badge badge-accent border-0 font-mono font-bold",
  info: "badge badge-info border-0 font-mono font-bold",
  success: "badge badge-success border-0 font-mono font-bold",
  warning: "badge badge-warning border-0 font-mono font-bold",
};

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
      />
    </svg>
  );
}

const GalleryFilterCheatsheetModal = () => {
  const containerRef = useRef<ModalHandle>(null);
  const isNeo = useIsNeo();

  useEffect(() => {
    if (containerRef.current) {
      useModalStore.getState().register("GalleryFilterCheatsheetModal", containerRef.current);
    }
    return () => useModalStore.getState().unregister("GalleryFilterCheatsheetModal");
  }, []);

  const close = () => containerRef.current?.close();

  return (
    <Modal
      id="GalleryFilterCheatsheetModal"
      ref={containerRef}
      showCloseButton={false}
      className={cn(
        "modal-box flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0",
        isNeo && "rounded-none border-4 border-base-content shadow-[8px_8px_0_0_#000]",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-start justify-between gap-4 px-6 pb-5 pt-6 md:px-10 md:pb-6 md:pt-8",
          isNeo
            ? "border-b-4 border-base-content bg-secondary text-secondary-content"
            : "border-b border-base-300 bg-base-200",
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <h2
            className={cn(
              "font-bold uppercase leading-none tracking-tighter text-base-content",
              isNeo
                ? "font-[family-name:var(--font-display)] text-3xl italic md:text-5xl"
                : "font-[family-name:var(--font-display)] text-2xl md:text-4xl",
            )}
          >
            Gallery filter syntax
          </h2>
          <p
            className={cn(
              "max-w-2xl text-sm leading-relaxed md:text-base",
              isNeo ? "text-secondary-content/95" : "text-base-content/80",
            )}
          >
            Our filter bar uses a <strong>token-based</strong> model: one chip per token. Multiple chips combine with{" "}
            <strong>AND</strong> — an image must satisfy every active token. Resolution filters live under{" "}
            <strong>Filters</strong> (advanced), not in this bar.
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "btn shrink-0",
            isNeo
              ? "rounded-none border-4 border-base-content bg-base-100 text-base-content shadow-[4px_4px_0_0_#000] hover:bg-error hover:text-error-content active:translate-x-1 active:translate-y-1 active:shadow-none"
              : "btn-ghost btn-square btn-sm",
          )}
          aria-label="Close"
          onClick={close}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-10 overflow-y-auto px-6 py-8 md:px-10 md:py-10">
        <section className="max-w-3xl space-y-3">
          <h3
            className={cn(
              "font-[family-name:var(--font-display)] font-bold uppercase tracking-tight text-base-content",
              isNeo ? "text-xl underline decoration-4 decoration-primary underline-offset-4" : "text-lg",
            )}
          >
            Token reference
          </h3>
          <p className={cn("text-base leading-relaxed", isNeo ? "text-base-content" : "text-base-content/90")}>
            Type a prefix and value, then press Enter or pick a suggestion where available. Plain text without a prefix is
            treated like <code className="font-mono text-sm">q:</code> after splitting.
          </p>
        </section>

        <section
          className={cn(
            "grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3",
          )}
        >
          {GALLERY_FILTER_CHEATSHEET_CARDS.map((card) => (
            <article
              key={card.prefix}
              className={cn(
                "flex flex-col gap-3 p-4",
                isNeo
                  ? "rounded-none border-4 border-base-content bg-base-200 shadow-[4px_4px_0_0_#000] transition-transform hover:-translate-y-0.5"
                  : "rounded-box border border-base-300 bg-base-100 shadow-sm",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={badgeClass[card.badgeVariant]}>{card.prefix}</span>
                <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-tight text-base-content">
                  {card.title}
                </span>
              </div>
              <p className={cn("text-sm leading-snug", isNeo ? "opacity-90" : "text-base-content/80")}>{card.description}</p>
              <div
                className={cn(
                  "font-mono text-xs italic",
                  isNeo
                    ? "border-2 border-base-content/20 bg-base-300 p-2 text-base-content"
                    : "rounded-md bg-base-200 p-2 text-base-content/90",
                )}
              >
                {card.example}
              </div>
            </article>
          ))}
        </section>

        <footer
          className={cn(
            "space-y-4 p-6 md:p-8",
            isNeo
              ? "rounded-none border-t-4 border-base-content bg-neutral text-neutral-content"
              : "rounded-box bg-neutral text-neutral-content",
          )}
        >
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase italic text-secondary md:text-xl">
            Combining tokens
          </h3>
          <div className="grid gap-4 text-sm leading-relaxed md:grid-cols-2">
            <p className={cn("border-l-4 pl-4", isNeo ? "border-secondary" : "border-secondary/80")}>
              <strong className="text-secondary">Multiple color tokens:</strong> each <code className="bg-white/10 px-1 font-mono">color:</code>{" "}
              token is required — stored palette must include every requested swatch (AND).
            </p>
            <p className={cn("border-l-4 pl-4", isNeo ? "border-secondary" : "border-secondary/80")}>
              <strong className="text-secondary">Near constraints:</strong> the <code className="bg-white/10 px-1 font-mono">~</code> suffix
              on <code className="bg-white/10 px-1 font-mono">near:</code> sets the maximum CIE76 ΔE. Multiple{" "}
              <code className="bg-white/10 px-1 font-mono">near:</code> tokens are also ANDed.
            </p>
          </div>
        </footer>

        <aside
          className={cn(
            "flex flex-col items-start gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between",
            isNeo ? "border-base-content border-t-4" : "border-base-300",
          )}
        >
          <div className="flex items-start gap-3">
            <InfoIcon />
            <p className="font-mono text-[10px] uppercase leading-tight tracking-widest text-base-content/80">
              Dominant colors per image come from k-means in CIELAB at import time, stored as hex swatches.
            </p>
          </div>
        </aside>
      </div>
    </Modal>
  );
};

export default GalleryFilterCheatsheetModal;
