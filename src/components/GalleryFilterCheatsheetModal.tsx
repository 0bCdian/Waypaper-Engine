import { useEffect, useRef } from "react";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { GALLERY_FILTER_CHEATSHEET_CARDS } from "../utils/galleryFilterCheatsheetContent";

const badgeClass: Record<(typeof GALLERY_FILTER_CHEATSHEET_CARDS)[number]["badgeVariant"], string> =
  {
    primary: "badge badge-primary border-0 font-mono font-bold",
    secondary: "badge badge-secondary border-0 font-mono font-bold text-secondary-content",
    accent: "badge badge-accent border-0 font-mono font-bold",
    info: "badge badge-info border-0 font-mono font-bold",
    success: "badge badge-success border-0 font-mono font-bold",
    warning: "badge badge-warning border-0 font-mono font-bold",
  };

/** Inline code inside `footer` neutrals — uses neutral-content scales for WCAG on both light/dark neutrals */
const cheatsheetNeutralCodeCls =
  "rounded bg-neutral-content/15 px-1 font-mono text-neutral-content ring-1 ring-inset ring-neutral-content/25";

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8 shrink-0 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
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

  useEffect(() => {
    if (containerRef.current) {
      useModalStore.getState().register("GalleryFilterCheatsheetModal", containerRef.current);
    }
    return () => useModalStore.getState().unregister("GalleryFilterCheatsheetModal");
  }, []);

  return (
    <Modal
      id="GalleryFilterCheatsheetModal"
      ref={containerRef}
      stripedHeader={{
        title: "Gallery filter syntax",
        subtitle: (
          <>
            Our filter bar uses a <strong className="font-bold">token-based</strong> model: one chip
            per token. Multiple chips combine with <strong className="font-bold">AND</strong> — an
            image must satisfy every active token. Resolution filters live under{" "}
            <strong className="font-bold">Filters</strong> (advanced), not in the search bar.
          </>
        ),
        bleedInsetDefault: false,
        titleDefaultExtra: "tracking-tighter md:text-4xl",
        subtitleDefaultExtra: "max-w-2xl leading-relaxed text-base-content/80",
      }}
      className="modal-box flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0"
    >
      <div className="min-h-0 flex-1 space-y-10 overflow-y-auto px-6 py-8 md:px-10 md:py-10">
        <section className="max-w-3xl space-y-3">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-tight text-base-content">
            Token reference
          </h3>
          <p className="text-base leading-relaxed text-base-content/90">
            Type a prefix and value, then press Enter or pick a suggestion where available. Plain
            text without a prefix is treated like <code className="font-mono text-sm">q:</code>{" "}
            after splitting.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {GALLERY_FILTER_CHEATSHEET_CARDS.map((card) => (
            <article
              key={card.prefix}
              className="flex flex-col gap-3 p-4 rounded-[var(--wp-radius-md)] border-[length:var(--wp-border-w)] border-[var(--wp-border-color)] bg-base-100 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={badgeClass[card.badgeVariant]}>{card.prefix}</span>
                <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-tight text-base-content">
                  {card.title}
                </span>
              </div>
              <p className="text-sm leading-snug text-base-content/80">{card.description}</p>
              <div className="font-mono text-xs italic rounded-[var(--wp-radius-sm)] border-[length:var(--wp-border-w)] border-[var(--wp-border-color)] bg-base-200 p-2 text-base-content/90">
                {card.example}
              </div>
            </article>
          ))}
        </section>

        <footer className="space-y-4 p-6 md:p-8 rounded-[var(--wp-radius-md)] bg-neutral text-neutral-content">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase italic text-neutral-content md:text-xl">
            Combining tokens
          </h3>
          <div className="grid gap-4 text-sm leading-relaxed text-neutral-content/95 md:grid-cols-2 [&_strong]:font-semibold [&_strong]:text-neutral-content">
            <p className="border-l-4 border-neutral-content/35 pl-4">
              <strong>Multiple color tokens:</strong> each{" "}
              <code className={cheatsheetNeutralCodeCls}>color:</code> token is required — stored
              palette must include every requested swatch (AND).
            </p>
            <p className="border-l-4 border-neutral-content/35 pl-4">
              <strong>Near constraints:</strong> the{" "}
              <code className={cheatsheetNeutralCodeCls}>~</code> suffix on{" "}
              <code className={cheatsheetNeutralCodeCls}>near:</code> sets the maximum CIE76 ΔE.
              Multiple <code className={cheatsheetNeutralCodeCls}>near:</code> tokens are also
              ANDed.
            </p>
          </div>
        </footer>

        <aside className="flex flex-col items-start gap-3 border-t-[length:var(--wp-border-w)] border-[var(--wp-border-color)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <InfoIcon />
            <p className="font-mono self-center text-[10px] uppercase leading-tight tracking-widest text-base-content/80">
              Dominant colors per image come from k-means in CIELAB at import time, stored as hex
              swatches.
            </p>
          </div>
        </aside>
      </div>
    </Modal>
  );
};

export default GalleryFilterCheatsheetModal;
