import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import { useIsNeo } from "../hooks/useIsNeo";
import PlaylistTrack from "./PlaylistTrack";

type Props = {
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
};

function BottomDock({ currentPage, totalPages, handlePageChange }: Props) {
  const isNeo = useIsNeo();

  return (
    <div
      data-prevent-gallery-marquee
      className={`shrink-0 min-w-0 overflow-x-clip overflow-y-visible mx-2 lg:mx-4 mb-2${
        isNeo ? " neo-bottom-dock" : " wp-bottom-dock"
      }`}
    >
      {/* Pagination row */}
      <div className="flex flex-col items-center gap-1 px-3 py-2 lg:px-4 lg:py-2.5">
        <div className="max-w-2xl min-w-1">
          <ResponsivePagination
            total={totalPages}
            previousClassName="rounded_button_previous"
            nextClassName="rounded_button_next"
            current={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
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
