import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import PlaylistTrack from "./PlaylistTrack";
import { cn } from "../utils/cn";

type Props = {
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
};

/** Previous/Next live outside the page list so they stay put while the list changes width. */
function PageStep({
  label,
  ariaLabel,
  disabled,
  onClick,
  className,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <ul className="pagination shrink-0">
      <li className={cn("page-item", className, disabled && "disabled")}>
        <button
          type="button"
          className="page-link"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={onClick}
        >
          {label}
        </button>
      </li>
    </ul>
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
          <div className="flex w-full max-w-2xl min-w-1 items-center gap-1">
            <PageStep
              label="«"
              ariaLabel="Previous page"
              className="rounded_button_previous"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            />
            <div className="min-w-0 flex-1">
              <ResponsivePagination
                total={totalPages}
                current={currentPage}
                onPageChange={handlePageChange}
                renderNav={false}
              />
            </div>
            <PageStep
              label="»"
              ariaLabel="Next page"
              className="rounded_button_next"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            />
          </div>
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
