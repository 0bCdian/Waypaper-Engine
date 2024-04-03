import Sharp = require('sharp');
import { configuration } from '../config/config';
import { appDirectories } from '../config/appPaths';
import { join } from 'node:path';
import { getSwwwCommandFromConfiguration } from '../utils/monitorUtils';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { type Monitor } from '../types/monitor';
import { notifyImageSet } from './notifications';
import { type rendererImage } from '../types/daemonTypes';
import { type imageSelectType } from '../database/schema';
const execPomisified = promisify(exec);

export async function resizeImageToFitMonitor(
    buffer: Sharp.Sharp,
    Image: rendererImage,
    requiredWidth: number,
    requiredHeight: number
) {
    const widthDifferenceImageToMonitors = requiredWidth - Image.width;
    const heightDifferenceImageToCurrentMonitor = requiredHeight - Image.height;
    const resizedImageFileName = `${appDirectories.tempImages}/resized.${Image.format}`;
    if (
        widthDifferenceImageToMonitors < 0 ||
        heightDifferenceImageToCurrentMonitor < 0
    ) {
        await buffer
            .resize({
                width: requiredWidth,
                height: requiredHeight,
                fit: 'cover',
                background: hexToSharpRgb(configuration.swww.settings.fillColor)
            })
            .toFile(resizedImageFileName);
    } else if (
        widthDifferenceImageToMonitors === 0 &&
        heightDifferenceImageToCurrentMonitor === 0
    ) {
        await buffer.toFile(resizedImageFileName);
    } else {
        await buffer
            .resize({
                width: requiredWidth,
                height: requiredHeight,
                fit: 'fill',
                background: hexToSharpRgb(configuration.swww.settings.fillColor)
            })
            .toFile(resizedImageFileName);
    }
    return resizedImageFileName;
}

function hexToSharpRgb(hex: string) {
    const parsedHex = hex.replace(/^#/, '').toLowerCase();
    const r = parseInt(parsedHex.slice(0, 2), 16);
    const g = parseInt(parsedHex.slice(2, 4), 16);
    const b = parseInt(parsedHex.slice(4, 6), 16);
    const rgbObject = {
        r,
        g,
        b,
        alpha: 1
    };
    return rgbObject;
}

function getDesiredDimensionsToExtendImage(Monitors: Monitor[]) {
    const desiredDimensions = Monitors.reduce(
        (previousValue, currentValue) => {
            const maxCurrentX = currentValue.position.x + currentValue.width;
            const maxCurrentY = currentValue.position.y + currentValue.height;
            let newX = previousValue.x;
            let newY = previousValue.y;
            if (maxCurrentX > newX) {
                newX = maxCurrentX;
            }
            if (maxCurrentY > newY) {
                newY = maxCurrentY;
            }
            return { x: newX, y: newY };
        },
        { x: 0, y: 0 }
    );
    return desiredDimensions;
}
export async function extendImageAcrossMonitors(
    image: rendererImage | imageSelectType,
    imageFilePath: string,
    monitors: Monitor[]
) {
    const monitorsToImagesPairsArray: Array<{
        monitor: string;
        image: string;
    }> = [];
    for (let index = 0; index < monitors.length; index++) {
        const monitor = monitors[index];
        const monitorX =
            monitor.position.x === 0
                ? monitor.position.x
                : monitor.position.x - 1;
        const monitorY =
            monitor.position.y === 0
                ? monitor.position.y
                : monitor.position.y - 1;
        const finalImageName = join(
            appDirectories.tempImages,
            `${index}.${image.format}`
        );

        const desiredDimensions = getDesiredDimensionsToExtendImage(monitors);
        const resizedImageFilename = await resizeImageToDesiredResolution(
            desiredDimensions,
            Sharp(imageFilePath, {
                animated: true,
                limitInputPixels: false
            })
        );
        const buffer = Sharp(resizedImageFilename, {
            animated: true,
            limitInputPixels: false
        });
        await buffer
            .extract({
                left: monitorX,
                top: monitorY,
                width: monitor.width,
                height: monitor.height
            })
            .toFile(finalImageName);
        monitorsToImagesPairsArray.push({
            monitor: monitors[index].name,
            image: finalImageName
        });
    }
    return monitorsToImagesPairsArray;
}

async function resizeImageToDesiredResolution(
    desiredDimensions: {
        x: number;
        y: number;
    },
    buffer: Sharp.Sharp
): Promise<string> {
    const { width, height, format } = await buffer.metadata();
    if (width === undefined || height === undefined) {
        throw new Error('Image metadata is broken');
    }
    let finalWidth = width;
    let finalHeight = height;
    const resizedImageFileName = `${appDirectories.tempImages}/resized.${format}`;
    if (finalWidth < desiredDimensions.x) {
        finalWidth = desiredDimensions.x;
    }
    if (finalHeight < desiredDimensions.y) {
        finalHeight = desiredDimensions.y;
    }
    await buffer
        .resize({
            width: finalWidth,
            height: finalHeight,
            fit: 'cover',
            background: hexToSharpRgb(configuration.swww.settings.fillColor)
        })
        .toFile(resizedImageFileName);
    return resizedImageFileName;
}

export async function setImageAcrossMonitors(
    image: rendererImage | imageSelectType,
    monitors: Monitor[]
) {
    const imageFilePath = join(appDirectories.imagesDir, image.name);
    try {
        const commands: Array<Promise<any>> = [];
        const monitorsToImagesPair = await extendImageAcrossMonitors(
            image,
            imageFilePath,
            monitors
        );
        monitorsToImagesPair.forEach(pair => {
            commands.push(
                execPomisified(
                    getSwwwCommandFromConfiguration(pair.image, pair.monitor)
                )
            );
        });
        void Promise.all(commands);
        if (configuration.script !== undefined) {
            await execPomisified(`${configuration.script} ${imageFilePath}`);
        }
        notifyImageSet(image.name, imageFilePath);
    } catch (error) {
        console.error(error);
    }
}

export async function duplicateImageAcrossMonitors(
    image: rendererImage | imageSelectType,
    monitors: Monitor[]
) {
    const imageFilePath = join(appDirectories.imagesDir, image.name);
    const monitorsString = monitors.reduce((prev, current) => {
        prev = prev.concat(current.name, ',');
        return prev;
    }, '');
    const command = getSwwwCommandFromConfiguration(
        imageFilePath,
        monitorsString
    );
    try {
        void execPomisified(command);
        if (configuration.script !== undefined) {
            await execPomisified(`${configuration.script} ${imageFilePath}`);
        }
        notifyImageSet(image.name, imageFilePath);
    } catch (error) {
        console.error(error);
    }
}
