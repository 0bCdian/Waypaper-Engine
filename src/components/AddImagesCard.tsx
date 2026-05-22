import type { KeyboardEvent, ReactNode } from "react";
import SvgComponent from "./AddImagesIcon";
import SvgComponentFolder from "./AddFoldersIcon";
import AddVideosIcon from "./AddVideosIcon";
import AddWebWallpaperIcon from "./AddWebWallpaperIcon";
import openImagesStore from "../hooks/useOpenImages";
import type { openFileAction } from "../../shared/types";
import { useShallow } from "zustand/react/shallow";

const cardClass =
  "flex w-[300px] shrink-0 flex-col rounded-lg border-0 bg-transparent p-3 cursor-pointer transition-all ease-in-out hover:bg-base-300 active:scale-95";
const iconSlotClass = "flex min-h-[200px] flex-1 items-center justify-center rounded-lg";
const labelClass =
  "shrink-0 px-1 pt-3 text-center text-sm font-bold leading-snug text-base-content";

function AddActionCard(props: {
  action: openFileAction;
  label: string;
  ariaLabel: string;
  isActive: boolean;
  onOpen: (action: openFileAction) => void;
  children: ReactNode;
}) {
  const { action, label, ariaLabel, isActive, onOpen, children } = props;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isActive) {
        onOpen(action);
      }
    }
  };

  return (
    <button
      type="button"
      className={cardClass}
      onClick={isActive ? undefined : () => onOpen(action)}
      onKeyDown={onKeyDown}
      disabled={isActive}
      aria-label={ariaLabel}
    >
      <div className={iconSlotClass}>{children}</div>
      <p className={labelClass}>{label}</p>
    </button>
  );
}

function AddImagesCard() {
  const { openImages, isActive } = openImagesStore(
    useShallow((s) => ({
      openImages: s.openImages,
      isActive: s.isActive,
    })),
  );

  const onOpen = (action: openFileAction) => {
    void openImages({ action });
  };

  return (
    <div className="flex flex-wrap content-start items-stretch justify-center gap-8 lg:gap-12">
      <AddActionCard
        action="file"
        label="Add individual images"
        ariaLabel="Add individual images"
        isActive={isActive}
        onOpen={onOpen}
      >
        <SvgComponent />
      </AddActionCard>
      <AddActionCard
        action="folder"
        label="Add images from directory"
        ariaLabel="Add images from directory"
        isActive={isActive}
        onOpen={onOpen}
      >
        <SvgComponentFolder />
      </AddActionCard>
      <AddActionCard
        action="video"
        label="Add videos"
        ariaLabel="Add videos"
        isActive={isActive}
        onOpen={onOpen}
      >
        <AddVideosIcon />
      </AddActionCard>
      <AddActionCard
        action="web"
        label="Import web wallpaper"
        ariaLabel="Import web wallpaper"
        isActive={isActive}
        onOpen={onOpen}
      >
        <AddWebWallpaperIcon />
      </AddActionCard>
    </div>
  );
}

export default AddImagesCard;
