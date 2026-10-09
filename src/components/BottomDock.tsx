import "../custom.css";
import PlaylistTrack from "./PlaylistTrack";
import { cn } from "../utils/cn";
import { pageSlots } from "../utils/pageSlots";

type Props = {
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
};

function PageButton({
  label,
  ariaLabel,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <li className={cn("page-item", active && "active", disabled && "disabled")}>
      <button
        type="button"
        className="page-link"
        aria-label={ariaLabel}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </li>
  );
}

function BottomDock({ currentPage, totalPages, handlePageChange }: Props) {
  return (
    <div
      data-prevent-gallery-marquee
      className="shrink-0 min-w-0 overflow-x-clip overflow-y-visible mx-2 lg:mx-4 mb-2 [@media(max-height:1080px)]:mb-1 [@media(max-height:1080px)]:mx-2 wp-bottom-dock neo-bottom-dock"
    >
      {/* Pagination row */}
      <div className="flex flex-col items-center gap-1 px-3 py-2 lg:px-4 lg:py-2.5 [@media(max-height:1080px)]:gap-0.5 [@media(max-height:1080px)]:px-2 [@media(max-height:1080px)]:py-1.5 [@media(max-height:1080px)]:lg:px-3 [@media(max-height:1080px)]:lg:py-2">
        {totalPages > 1 && (
          <ul className="pagination" aria-label="Gallery pages">
            <PageButton
              label="«"
              ariaLabel="Previous page"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            />
            {pageSlots(currentPage, totalPages).map((slot) =>
              typeof slot === "number" ? (
                <PageButton
                  key={slot}
                  label={String(slot)}
                  ariaLabel={`Page ${slot}`}
                  active={slot === currentPage}
                  onClick={() => handlePageChange(slot)}
                />
              ) : (
                <PageButton key={slot} label="…" ariaLabel="More pages" disabled />
              ),
            )}
            <PageButton
              label="»"
              ariaLabel="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            />
          </ul>
        )}
        {totalPages > 1 && (
          <span className="text-xs text-base-content/50 whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Playlist header + mini-card strip */}
      <PlaylistTrack />
    </div>
  );
}

export default BottomDock;
