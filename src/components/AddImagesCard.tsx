import SvgComponent from "./addImagesIcon";
import SvgComponentFolder from "./AddFoldersIcon";
import openImagesStore from "../hooks/useOpenImages";
import { type openFileAction } from "../../shared/types";
import { useCallback } from "react";

function AddImagesCard() {
    const { openImages, isActive } = openImagesStore();
    const handleClickAddImages = useCallback((action: openFileAction) => {
        void openImages({
            action
        });
    }, []);

    return (
        <div className="flex gap-20">
            <div
                className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95"
                onClick={
                    isActive
                        ? undefined
                        : () => {
                              handleClickAddImages("file");
                          }
                }
            >
                <div className="flex min-h-[200px] min-w-[300px] justify-center rounded-lg">
                    <SvgComponent />
                </div>
                <p className="absolute left-16 top-[75%] font-bold text-base-content">
                    Add individual images
                </p>
            </div>
            <div
                className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-base-300 active:scale-95"
                onClick={
                    isActive
                        ? undefined
                        : () => {
                              handleClickAddImages("folder");
                          }
                }
            >
                <div className="mt-[4.1rem] flex min-w-[300px] justify-center rounded-lg">
                    <SvgComponentFolder />
                </div>
                <p className="absolute left-12 top-[75%] font-bold text-base-content">
                    Add images from directory
                </p>
            </div>
        </div>
    );
}

export default AddImagesCard;
