import { playlistStore } from '../stores/playlist';
import { useMonitorStore } from '../stores/monitors';
import { type rendererImage } from '../types/rendererTypes';
import { imagesStore } from '../stores/images';
import { PLAYLIST_TYPES } from '../../shared/types/playlist';
import { useEffect } from 'react';
const { readActivePlaylist } = window.API_RENDERER;
export function useSetLastActivePlaylist() {
    const { setPlaylist, playlist, setEmptyPlaylist } = playlistStore();
    const { activeMonitor } = useMonitorStore();
    const { imagesArray } = imagesStore();
    useEffect(() => {
        if (activeMonitor.name === '') return;
        if (activeMonitor.name === playlist.monitor.name) return;
        void readActivePlaylist(activeMonitor).then(playlistFromDB => {
            if (playlistFromDB === undefined) {
                setEmptyPlaylist();
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
                    playlistType: playlistFromDB.type,
                    order: playlistFromDB.order,
                    interval: playlistFromDB.interval,
                    showAnimations: playlistFromDB.showAnimations
                },
                images: imagesToStorePlaylist,
                monitor: activeMonitor
            };
            setPlaylist(currentPlaylist);
        });
    }, [activeMonitor]);
}
