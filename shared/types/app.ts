export interface appConfigType {
    killDaemon: boolean;
    notifications: boolean;
    startMinimized: boolean;
    minimizeInsteadOfClose: boolean;
    randomImageMonitor: 'clone' | 'extend' | 'individual';
    showMonitorModalOnStart: boolean;
    imagesPerPage: number;
}
