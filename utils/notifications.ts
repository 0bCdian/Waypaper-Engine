import { exec } from "node:child_process";
import { configReader } from "../globals/configReader";
import { logger } from "../globals/setup";

export function notifyImageSet(imageName: string, imagePath: string) {
    const config = configReader.getCurrentConfig();
    if (!config.app.notifications) return;
    
    const notifySend = `notify-send -u low -t 2000 -i "${imagePath}" -a "Waypaper Engine" "Waypaper Engine" "Setting image: ${imageName}"`;
    exec(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            logger.error(err);
        }
    });
}

export function notify(message: string) {
    const config = configReader.getCurrentConfig();
    if (!config.app.notifications) return;
    
    const notifySend = `notify-send -u normal -t 2000 -a "Waypaper Engine" "Waypaper Engine" "${message}"`;
    exec(notifySend, (err, _stdout, _stderr) => {
        if (err !== null) {
            logger.error(err);
        }
    });
}
