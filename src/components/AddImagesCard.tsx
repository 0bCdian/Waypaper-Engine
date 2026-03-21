import SvgComponent from "./AddImagesIcon";
import SvgComponentFolder from "./AddFoldersIcon";
import openImagesStore from "../hooks/useOpenImages";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useState } from "react";
import type { openFileAction } from "../../shared/types";

function AddImagesCard() {
  const { openImages, isActive } = openImagesStore(
    useShallow((s) => ({
      openImages: s.openImages,
      isActive: s.isActive,
    })),
  );
  const [capabilities, setCapabilities] = useState<string[] | null>(null);
  useEffect(() => {
    void window.API_RENDERER.goDaemon
      .getBackendCapabilities()
      .then((caps) => setCapabilities(caps?.media_types ?? null))
      .catch(() => setCapabilities(null));
  }, []);
  const canImportVideo = capabilities ? capabilities.includes("video") : true;
  const canImportWeb = capabilities ? capabilities.includes("web") : true;
  const handleClickAddImages = (action: openFileAction) => {
    void openImages({
      action,
    });
  };

  const handleKeyDown = (action: openFileAction) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isActive) {
        handleClickAddImages(action);
      }
    }
  };

  return (
    <div className="flex gap-20">
      <button
        type="button"
        className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95 border-0 bg-transparent p-0"
        onClick={
          isActive
            ? undefined
            : () => {
                handleClickAddImages("file");
              }
        }
        onKeyDown={handleKeyDown("file")}
        disabled={isActive}
        aria-label="Add individual images"
      >
        <div className="flex min-h-[200px] min-w-[300px] justify-center rounded-lg">
          <SvgComponent />
        </div>
        <p className="absolute left-16 top-[75%] font-bold text-base-content">
          Add individual images
        </p>
      </button>
      <button
        type="button"
        className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95 border-0 bg-transparent p-0"
        onClick={
          isActive
            ? undefined
            : () => {
                handleClickAddImages("folder");
              }
        }
        onKeyDown={handleKeyDown("folder")}
        disabled={isActive}
        aria-label="Add images from directory"
      >
        <div className="flex min-w-[300px] justify-center rounded-lg">
          <SvgComponentFolder />
        </div>
        <p className="absolute left-12 top-[75%] font-bold text-base-content">
          Add images from directory
        </p>
      </button>
      <button
        type="button"
        className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95 border-0 bg-transparent p-0"
        onClick={
          isActive || !canImportVideo
            ? undefined
            : () => {
                handleClickAddImages("video");
              }
        }
        onKeyDown={handleKeyDown("video")}
        disabled={isActive || !canImportVideo}
        aria-label="Add videos"
      >
        <div className="flex min-h-[200px] min-w-[260px] items-center justify-center rounded-lg">
          <span className="text-4xl font-bold">VIDEO</span>
        </div>
        <p className="absolute left-20 top-[75%] font-bold text-base-content">
          {canImportVideo ? "Add videos" : "Video unsupported"}
        </p>
      </button>
      <button
        type="button"
        className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95 border-0 bg-transparent p-0"
        onClick={
          isActive || !canImportWeb
            ? undefined
            : () => {
                handleClickAddImages("web");
              }
        }
        onKeyDown={handleKeyDown("web")}
        disabled={isActive || !canImportWeb}
        aria-label="Import web wallpaper"
      >
        <div className="flex min-h-[200px] min-w-[260px] items-center justify-center rounded-lg">
          <span className="text-4xl font-bold">WEB</span>
        </div>
        <p className="absolute left-14 top-[75%] font-bold text-base-content">
          {canImportWeb ? "Import web wallpaper" : "Web unsupported"}
        </p>
      </button>
    </div>
  );
}

export default AddImagesCard;
