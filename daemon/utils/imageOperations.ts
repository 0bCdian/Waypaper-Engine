import Sharp = require('sharp');
import { configuration } from '../config/config';
import { appDirectories } from '../config/appPaths';
import { join } from 'node:path';
import { getSwwwCommandFromConfiguration } from '../utils/monitorUtils';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { type Monitor, type cacheJson } from '../types/monitor';
import { notifyImageSet } from './notifications';
import { type rendererImage } from '../types/daemonTypes';
import { type imageSelectType } from '../database/schema';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
const execPomisified = promisify(exec);

export async function resizeImageToFitMonitor(
    buffer: Sharp.Sharp,
    Image: rendererImage,
    requiredWidth: number,
    requiredHeight: number
) {
    const widthDifferenceImageToMonitors = requiredWidth - Image.width;
    const heightDifferenceImageToCurrentMonitor = requiredHeight - Image.height;
    const resizedImageFileName = `${appDirectories.extendedImages}/resized.${Image.format}`;
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
export async function createSplitImages(
    image: rendererImage | imageSelectType,
    imageFilePath: string,
    monitors: Monitor[],
    imageNameWithoutExtension: string
) {
    const monitorImagePairs: Array<{
        monitor: Monitor;
        image: string;
    }> = [];
    const dirFilePath = join(
        appDirectories.extendedImages,
        imageNameWithoutExtension
    );

    createOrEmptyDirectory(dirFilePath);
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
            dirFilePath,
            `${monitor.name}_${index}_${image.name}`
        );
        const desiredDimensions = getDesiredDimensionsToExtendImage(monitors);
        const resizedImageFilename = await resizeImageToDesiredResolution(
            desiredDimensions,
            Sharp(imageFilePath, {
                animated: true,
                limitInputPixels: false
            }),
            dirFilePath
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
        monitorImagePairs.push({
            monitor: monitors[index],
            image: finalImageName
        });
    }
    createSplitImagesJson({
        Image: image,
        imageNameWithoutExtension,
        monitorImagePairs
    });
    return monitorImagePairs;
}

async function resizeImageToDesiredResolution(
    desiredDimensions: {
        x: number;
        y: number;
    },
    buffer: Sharp.Sharp,
    directoryPath: string
): Promise<string> {
    const { width, height, format } = await buffer.metadata();
    if (width === undefined || height === undefined) {
        throw new Error('Image metadata is broken');
    }
    let finalWidth = width;
    let finalHeight = height;
    const resizedImageFileName = `${directoryPath}/resized.${format}`;
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
    monitors: Monitor[],
    showAnimations: boolean
) {
    const imageNameWithoutExtension = image.name.split('.').at(0);
    if (imageNameWithoutExtension === undefined) {
        console.error(
            `Could not extract image name without extension ${image.name}`
        );
        throw new Error(
            `Could not extract image name without extension ${image.name}`
        );
    }

    const imageFilePath = join(appDirectories.imagesDir, image.name);
    let monitorImagePairs: Array<{
        monitor: Monitor;
        image: string;
    }> = [];

    const cachedPairs = getCacheIfExists({
        imageNameWithoutExtension,
        monitors
    });
    if (cachedPairs !== undefined) {
        monitorImagePairs = cachedPairs;
    } else {
        monitorImagePairs = await createSplitImages(
            image,
            imageFilePath,
            monitors,
            imageNameWithoutExtension
        );
    }

    const commands: Array<Promise<any>> = [];
    monitorImagePairs.forEach(pair => {
        commands.push(
            execPomisified(
                getSwwwCommandFromConfiguration(
                    pair.image,
                    pair.monitor.name,
                    showAnimations
                )
            )
        );
    });
    await Promise.all(commands);
    if (configuration.script !== undefined) {
        await execPomisified(`${configuration.script} ${imageFilePath}`);
    }
}

export async function duplicateImageAcrossMonitors(
    image: rendererImage | imageSelectType,
    monitors: Monitor[],
    showAnimations: boolean
) {
    const imageFilePath = join(appDirectories.imagesDir, image.name);
    const monitorsString = monitors.reduce((prev, current) => {
        prev = prev.concat(current.name, ',');
        return prev;
    }, '');
    const command = getSwwwCommandFromConfiguration(
        imageFilePath,
        monitorsString,
        showAnimations
    );
    await execPomisified(command);
    if (configuration.script !== undefined) {
        await execPomisified(`${configuration.script} ${imageFilePath}`);
    }
    notifyImageSet(image.name, imageFilePath);
}

function createOrEmptyDirectory(path: string) {
    if (existsSync(path)) {
        rmSync(path);
        mkdirSync(path);
    } else {
        mkdirSync(path);
    }
}
function createSplitImagesJson({
    Image,
    imageNameWithoutExtension,
    monitorImagePairs
}: {
    Image: rendererImage | imageSelectType;
    imageNameWithoutExtension: string;
    monitorImagePairs: Array<{ image: string; monitor: Monitor }>;
}) {
    const cacheJson: cacheJson = {
        imageName: Image.name,
        monitors: monitorImagePairs.map(pair => {
            return {
                ...pair.monitor,
                currentImage: pair.image
            };
        })
    };
    writeFileSync(
        join(
            appDirectories.extendedImages,
            imageNameWithoutExtension,
            'info.json'
        ),
        JSON.stringify(cacheJson)
    );
}
function getCacheIfExists({
    imageNameWithoutExtension,
    monitors
}: {
    imageNameWithoutExtension: string;
    monitors: Monitor[];
}):
    | Array<{
          monitor: Monitor;
          image: string;
      }>
    | undefined {
    const dirLocation = join(
        appDirectories.extendedImages,
        imageNameWithoutExtension
    );

    if (!existsSync(dirLocation)) return;
    let areCompatible = false;
    const cacheJson: cacheJson = JSON.parse(
        readFileSync(join(dirLocation, 'info.json'), { encoding: 'utf8' })
    );
    for (let idx = 0; idx < monitors.length; idx++) {
        const monitorNew = monitors[idx];
        let matches = false;
        cacheJson.monitors.forEach(monitorCached => {
            if (
                monitorCached.name === monitorNew.name &&
                monitorCached.width === monitorNew.width &&
                monitorCached.height === monitorNew.height &&
                monitorCached.position.x === monitorNew.position.x
            ) {
                matches = true;
                areCompatible = true;
            }
        });
        if (!matches) {
            areCompatible = false;
            break;
        }
    }
    if (areCompatible) {
        return cacheJson.monitors.map(monitor => {
            return {
                image: monitor.currentImage,
                monitor
            };
        });
    }
}
