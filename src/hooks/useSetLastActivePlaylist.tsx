import { playlistStore } from '../stores/playlist';
import { useMonitorStore } from '../stores/monitors';
import {
    type rendererPlaylist,
    type rendererImage
} from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
import { PLAYLIST_TYPES } from '../../shared/types/playlist';
import { useEffect } from 'react';
const { readActivePlaylist, deletePlaylist } = window.API_RENDERER;
export function useSetLastActivePlaylist() {
    const { setPlaylist, playlist } = playlistStore();
    const { activeMonitor } = useMonitorStore();
    const { imagesArray } = imagesStore();
    useEffect(() => {
        if (activeMonitor.name === '') return;
        void readActivePlaylist(activeMonitor).then(playlistFromDB => {
            if (playlistFromDB === undefined) {
                // setEmptyPlaylist();
                return;
            }

            if (playlistFromDB.images.length < 1) {
                deletePlaylist(playlistFromDB.name);
                return;
            }

            if (playlist.name === playlistFromDB.name) {
                return;
            }
            const imagesToStorePlaylist: rendererImage[] = [];
            playlistFromDB.images.forEach(imageInActivePlaylist => {
                const imageToCheck = imagesArray.find(imageInGallery => {
                    return imageInGallery.name === imageInActivePlaylist.name;
                });
                if (imageToCheck === undefined) {
                    return;
                }
                if (
                    playlistFromDB.type === PLAYLIST_TYPES.TIME_OF_DAY &&
                    imageInActivePlaylist.time !== null
                ) {
                    imageToCheck.time = imageInActivePlaylist.time;
                }
                imageToCheck.isChecked = true;
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
