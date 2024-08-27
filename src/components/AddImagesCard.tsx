import SvgComponent from "./addImagesIcon";
import SvgComponentFolder from "./AddFoldersIcon";
import openImagesStore from "../hooks/useOpenImages";
import { playlistStore } from "../stores/playlist";
import { imagesStore } from "../stores/images";
import { type openFileAction } from "../../shared/types";
import { useCallback } from "react";

function AddImagesCard() {
    const { openImages, isActive } = openImagesStore();
    const { setSkeletons, addImages } = imagesStore();
    const { addImagesToPlaylist } = playlistStore();
    const handleClickAddImages = useCallback((action: openFileAction) => {
        void openImages({
            setSkeletons,
            addImages,
            addImagesToPlaylist,
            action
        });
    }, []);

    return (
        <div className="flex gap-20">
            <div
                className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-[#323232] active:scale-95"
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
                <p className="absolute left-[4rem] top-[75%] font-bold text-[#ebdbb2]">
                    Add individual images
                </p>
            </div>
            <div
                className="relative max-w-fit cursor-pointer rounded-lg transition-all ease-in-out hover:bg-[#323232] active:scale-95"
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
                <p className="absolute left-[3rem] top-[75%] font-bold text-[#ebdbb2]">
                    Add images from directory
                </p>
            </div>
        </div>
    );
}

export default AddImagesCard;
