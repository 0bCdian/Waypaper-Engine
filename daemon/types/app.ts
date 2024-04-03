export interface appConfigType {
    killDaemon: boolean;
    playlistStartOnFirstImage: boolean;
    notifications: boolean;
    swwwAnimations: boolean;
    startMinimized: boolean;
    minimizeInsteadOfClose: boolean;
    randomImageMonitor: 'clone' | 'extend' | 'individual';
    showMonitorModalOnStart: boolean;
    imagesPerPage: number;
}
