import Sharp = require('sharp');
import { configuration } from './database/globalConfig';
import { appDirectories } from './globals/appPaths';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { type Monitor } from '../shared/types/monitor';
import { type imageSelectType } from './database/schema';
import { type rendererImage } from '../src/types/rendererTypes';
const execPomisified = promisify(exec);
export async function resizeImageToFitMonitor(
    buffer: Sharp.Sharp,
    Image: imageSelectType,
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
                background: hexToSharpRgb(configuration.swww.config.fillColor)
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
                background: hexToSharpRgb(configuration.swww.config.fillColor)
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

export async function splitImageVerticalAxis(
    monitors: Monitor[],
    Image: imageSelectType,
    imageFilePath: string,
    combinedMonitorWidth: number
) {
    const monitorsToImagesPairsArray: Array<{
        monitor: string;
        image: string;
    }> = [];
    let lastWidth: number = 0;
    for (let current = 0; current < monitors.length; current++) {
        const finalImageName = join(
            appDirectories.tempImages,
            `${current}.${Image.format}`
        );
        const { width, height } = monitors[current];
        const resizedImageFilePath = await resizeImageToFitMonitor(
            Sharp(imageFilePath, {
                animated: true,
                limitInputPixels: false
            }),
            Image,
            combinedMonitorWidth,
            height
        );
        const buffer = Sharp(resizedImageFilePath, {
            animated: true,
            limitInputPixels: false
        });
        const metadata = await buffer.metadata();
        const extractHeight =
            metadata.format === 'gif' ? metadata.pageHeight : metadata.height;
        if (extractHeight === undefined)
            throw new Error(
                'Could not retrieve information from metadata something went wrong with the Sharp Buffer'
            );
        try {
            await buffer
                .extract({
                    left: lastWidth,
                    top: 0,
                    width,
                    height: extractHeight
                })
                .toFile(finalImageName);
            monitorsToImagesPairsArray.push({
                monitor: monitors[current].name,
                image: finalImageName
            });
            lastWidth += width - 1;
        } catch (error) {
            console.log(error);
        }
    }
    return monitorsToImagesPairsArray;
}

export async function splitImageHorizontalAxis(
    monitors: Monitor[],
    Image: imageSelectType,
    imageFilePath: string,
    combinedMonitorHeight: number
) {
    const monitorsToImagesPairsArray: Array<{
        monitor: string;
        image: string;
    }> = [];
    let lastHeight: number = 0;

    for (let current = 0; current < monitors.length; current++) {
        const finalImageName = join(
            appDirectories.tempImages,
            `${current}.${Image.format}`
        );
        const { width, height } = monitors[current];
        const resizedImageFilePath = await resizeImageToFitMonitor(
            Sharp(imageFilePath, {
                animated: true,
                limitInputPixels: false
            }),
            Image,
            width,
            combinedMonitorHeight
        );
        const buffer = Sharp(resizedImageFilePath, {
            animated: true,
            limitInputPixels: false
        });
        const metadata = await buffer.metadata();
        if (metadata.width === undefined)
            throw new Error(
                'Could not retrieve metadat.height something went wrong with the Sharp Buffer'
            );
        try {
            await buffer
                .extract({
                    left: 0,
                    top: lastHeight,
                    width: metadata.width,
                    height
                })
                .toFile(finalImageName);
            monitorsToImagesPairsArray.push({
                monitor: monitors[current].name,
                image: finalImageName
            });
            lastHeight += height - 1;
        } catch (error) {
            console.log(error);
        }
    }
    return monitorsToImagesPairsArray;
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
            background: hexToSharpRgb(configuration.swww.config.fillColor)
        })
        .toFile(resizedImageFileName);
    return resizedImageFileName;
}
function getSwwwCommandFromConfiguration(imagePath: string, monitor?: string) {
    const swwwConfig = configuration.swww.config;
    let transitionPos = '';
    const inverty = swwwConfig.invertY ? '--invert-y' : '';
    switch (swwwConfig.transitionPositionType) {
        case 'int':
            transitionPos = `${swwwConfig.transitionPositionIntX},${swwwConfig.transitionPositionIntY}`;
            break;
        case 'float':
            transitionPos = `${swwwConfig.transitionPositionFloatX},${swwwConfig.transitionPositionFloatY}`;
            break;
        case 'alias':
            transitionPos = swwwConfig.transitionPosition;
    }
    const command = `swww img "${imagePath}" ${
        monitor !== undefined ? `--outputs ${monitor}` : ''
    } --resize="${swwwConfig.resizeType}" --fill-color "${
        swwwConfig.fillColor
    }" --filter ${swwwConfig.filterType} --transition-type ${
        swwwConfig.transitionType
    } --transition-step ${swwwConfig.transitionStep} --transition-duration ${
        swwwConfig.transitionDuration
    } --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${
        swwwConfig.transitionAngle
    } --transition-pos ${transitionPos} ${inverty} --transition-bezier ${
        swwwConfig.transitionBezier
    } --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`;
    return command;
}

export async function setImageAcrossMonitors(
    image: rendererImage | imageSelectType,
    monitors: Monitor[]
) {
    const imageFilePath = join(appDirectories.imagesDir, image.name);
    const monitorsToImagesPair = await extendImageAcrossMonitors(
        image,
        imageFilePath,
        monitors
    );
    const commands: Array<Promise<any>> = [];
    monitorsToImagesPair.forEach(pair => {
        commands.push(
            execPomisified(
                getSwwwCommandFromConfiguration(pair.image, pair.monitor)
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
    await execPomisified(command);
    if (configuration.script !== undefined) {
        await execPomisified(`${configuration.script} ${imageFilePath}`);
    }
}
