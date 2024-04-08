import { playlistStore } from '../stores/playlist';
import { useMonitorStore } from '../stores/monitors';
import { type rendererImage } from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
import { PLAYLIST_TYPES } from '../../shared/types/playlist';
import { useEffect } from 'react';
const { readActivePlaylist, deletePlaylist } = window.API_RENDERER;
export function useSetLastActivePlaylist() {
    const {
        setPlaylist,
        playlist,
        setEmptyPlaylist,
        setActiveMonitorPlaylist
    } = playlistStore();
    const { activeMonitor } = useMonitorStore();
    const { imagesArray } = imagesStore();
    useEffect(() => {
        if (activeMonitor.name === '') return;
        void readActivePlaylist(activeMonitor).then(playlistFromDB => {
            if (playlistFromDB === undefined) {
                setEmptyPlaylist();
                setActiveMonitorPlaylist(activeMonitor);
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
                    playlistFromDB.type === PLAYLIST_TYPES.timeofday &&
                    imageInActivePlaylist.time !== null
                ) {
                    imageToCheck.time = imageInActivePlaylist.time;
                }
                imageToCheck.isChecked = true;
                imagesToStorePlaylist.push(imageToCheck);
            });
            const currentPlaylist = {
                name: playlistFromDB.name,
                configuration: {
                    type: playlistFromDB.type,
                    order: playlistFromDB.order,
                    interval: playlistFromDB.interval,
                    showAnimations: playlistFromDB.showAnimations
                },
                images: imagesToStorePlaylist,
                activeMonitor
            };
            setPlaylist(currentPlaylist);
        });
    }, [activeMonitor]);
}
