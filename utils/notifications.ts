import { exec } from 'node:child_process';
import { configuration } from '../globals/config';

export function notifyImageSet(imageName: string, imagePath: string) {
    if (!configuration.app.config.notifications) return;
    const notifySend = `notify-send -u low -t 2000 -i "${imagePath}" -a "Waypaper Engine" "Waypaper Engine" "Setting image: ${imageName}"`;
    exec(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            console.error(err);
        }
    });
}

export function notify(message: string) {
    if (!configuration.app.config.notifications) return;
    const notifySend = `notify-send -u normal -t 2000 -a "Waypaper Engine" "Waypaper Engine" "${message}"`;
    exec(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            console.error(err);
        }
    });
}
