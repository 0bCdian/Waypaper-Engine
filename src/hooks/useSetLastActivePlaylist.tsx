import { playlistStore } from "../stores/playlist";
import { useMonitorStore } from "../stores/monitors";
import {
    type rendererPlaylist,
    type rendererImage
} from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
import { PLAYLIST_TYPES } from "../../shared/types/playlist";
import { useEffect } from "react";
import { type DaemonPlaylistImage } from "../../shared/types/daemonEvents";
const { goDaemon } = window.API_RENDERER;
export function useSetLastActivePlaylist() {
    const { setPlaylist, playlist } = playlistStore();
    const { activeMonitor } = useMonitorStore();
    const { imagesArray } = imagesStore();
    useEffect(() => {
        if (activeMonitor.name === "") return;
        void goDaemon.getActivePlaylist(activeMonitor).then(playlistFromDB => {
            if (playlistFromDB === undefined || typeof playlistFromDB === 'string') {
                // setEmptyPlaylist();
                return;
            }
            if (!playlistFromDB.images || playlistFromDB.images.length < 1) {
                goDaemon.deletePlaylist(playlistFromDB.name);
                return;
            }

            if (playlist.name === playlistFromDB.name) {
                return;
            }
            const imagesToStorePlaylist: rendererImage[] = [];
            playlistFromDB.images.forEach((imageInActivePlaylist: DaemonPlaylistImage) => {
                const imageToCheck = imagesArray.find(imageInGallery => {
                    return imageInGallery.name === imageInActivePlaylist.name;
                });
                if (imageToCheck === undefined) {
                    return;
                }
                if (
                    playlistFromDB.type === PLAYLIST_TYPES.TIME_OF_DAY &&
                    imageInActivePlaylist.time !== undefined
                ) {
                    imageToCheck.time = imageInActivePlaylist.time;
                }
                imageToCheck.selection.isChecked = true;
                imagesToStorePlaylist.push(imageToCheck);
            });
            const currentPlaylist: rendererPlaylist = {
                name: playlistFromDB.name,
                configuration: {
                    type: playlistFromDB.type,
                    order: playlistFromDB.order,
                    interval: playlistFromDB.interval,
                    showAnimations: playlistFromDB.showAnimations,
                    alwaysStartOnFirstImage:
                        playlistFromDB.alwaysStartOnFirstImage
                },
                images: imagesToStorePlaylist,
                activeMonitor
            };
            setPlaylist(currentPlaylist);
        });
    }, [activeMonitor]);
}
