import { imagesStore } from "../stores/images";
import { playlistStore } from "../stores/playlist";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { type DaemonDeleteImageFromGalleryPayload } from "../../shared/types/daemonEvents";
import { type rendererImage } from "../types/rendererTypes";
const { goDaemon } = window.API_RENDERER;
let firstCall = true;
export function registerOnDelete() {
    const removeImagesFromStore = imagesStore(
        useShallow(state => state.removeImagesFromStore)
    );
    const removeImageFromPlaylist = playlistStore(
        useShallow(state => state.removeImagesFromPlaylist)
    );
    useEffect(() => {
        if (!firstCall) return;
        firstCall = false;
        goDaemon.on("delete_image_from_gallery", (...args: unknown[]) => {
            const image = args[0] as DaemonDeleteImageFromGalleryPayload;
            // Convert DaemonDeleteImageFromGalleryPayload to rendererImage for compatibility
            const imageToRemove: rendererImage = {
                id: image.id,
                name: image.name,
                path: image.path,
                mediaType: "image",
                dimensions: { width: 0, height: 0 },
                metadata: {
                    format: "",
                    fileSize: 0,
                    checksum: "",
                    tags: [],
                    properties: {}
                },
                selection: {
                    isChecked: false,
                    isSelected: false,
                    selectedAt: undefined,
                    selectedPlaylists: []
                },
                importInfo: {
                    importedAt: "",
                    sourcePath: image.path,
                    importer: "unknown"
                },
                thumbnails: {
                    "720p": "",
                    "1080p": "",
                    "1440p": "",
                    "4k": "",
                    fallback: ""
                },
                time: null
            };
            removeImagesFromStore([imageToRemove]);
            removeImageFromPlaylist(new Set([image.id]));
        });
    }, []);
}
