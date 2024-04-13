import { type BrowserWindow, dialog, Menu } from 'electron';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { copyFile, readdir } from 'node:fs/promises';
import { contextMenu } from './globals/menus';
import {
    type rendererImage,
    type rendererPlaylist
} from '../src/types/rendererTypes';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { binDir } from './binaries';
import { join, basename } from 'node:path';
import { parseResolution } from '../src/utils/utilities';
import { dbOperations } from './database/globalConfig';
import Sharp = require('sharp');
import {
    duplicateImageAcrossMonitors,
    setImageAcrossMonitors
} from './imageOperations';
import { type openFileAction, type imagesObject } from '../shared/types';
import { type imageMetadata } from './types/types';
import {
    type wlr_output,
    type Monitor,
    type ActiveMonitor
} from '../shared/types/monitor';
import { validImageExtensions } from '../shared/constants';
import { appDirectories } from './globals/appPaths';
import { type Formats } from '../shared/types/image';
import { type imageSelectType } from './database/schema';
import { initSwwwDaemon } from './startDaemons';
const execPomisified = promisify(exec);
const execFilePomisified = promisify(execFile);
function openImagesFromFilePicker(browserWindow: BrowserWindow | null) {
    if (browserWindow !== null) {
        return dialog.showOpenDialogSync(browserWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Images', extensions: validImageExtensions }],
            defaultPath: appDirectories.systemHome
        });
    }
    return dialog.showOpenDialogSync({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: validImageExtensions }],
        defaultPath: appDirectories.systemHome
    });
}

async function openFolderFromFilePicker(browserWindow: BrowserWindow | null) {
    let paths: string[] | undefined;
    if (browserWindow !== null) {
        paths = dialog.showOpenDialogSync(browserWindow, {
            properties: ['openDirectory', 'multiSelections'],
            defaultPath: appDirectories.systemHome
        });
    } else {
        paths = dialog.showOpenDialogSync({
            properties: ['openDirectory', 'multiSelections'],
            defaultPath: appDirectories.systemHome
        });
    }
    if (paths === undefined) return;
    const imageFilePaths: string[] = [];
    for (let index = 0; index < paths.length; index++) {
        const path = paths[index];
        await searchImagesRecursively(imageFilePaths, path);
    }
    return imageFilePaths;
}

async function searchImagesRecursively(
    imageFilePaths: string[],
    directory: string
) {
    const directoryContents = await readdir(directory, {
        recursive: false,
        encoding: 'utf-8',
        withFileTypes: true
    });
    for (let index = 0; index < directoryContents.length; index++) {
        const filePathOrDir = directoryContents[index];
        const fileName = filePathOrDir.name;
        if (filePathOrDir.isDirectory()) {
            await searchImagesRecursively(
                imageFilePaths,
                join(directory, fileName)
            );
        } else {
            const fileExtension = filePathOrDir.name
                .split('.')
                .at(-1) as Formats;
            if (
                fileExtension !== undefined &&
                validImageExtensions.includes(fileExtension)
            ) {
                imageFilePaths.push(join(directory, fileName));
            }
        }
    }
}

export async function copyImagesToCacheAndProcessThumbnails(
    _event: Electron.IpcMainInvokeEvent,
    { imagePaths, fileNames }: imagesObject
) {
    const uniqueFileNames = await checkAndRenameDuplicates(fileNames);
    const imagesToStore = uniqueFileNames.map(
        async (imageName, currentImage) => {
            return await new Promise<imageMetadata | undefined>(resolve => {
                void copyFile(
                    imagePaths[currentImage],
                    join(appDirectories.imagesDir, imageName)
                ).then(() => {
                    createCacheThumbnail(imagePaths[currentImage], imageName)
                        .then(imageMetadata => {
                            resolve(imageMetadata);
                        })
                        .catch(e => {
                            console.error(e);
                        });
                });
            });
        }
    );
    const resolvedObjectsArray = await Promise.allSettled(imagesToStore);
    const imagesToStoreinDB: imageMetadata[] = [];
    resolvedObjectsArray.forEach(imagePromise => {
        if (imagePromise.status === 'fulfilled') {
            const value = imagePromise.value;
            if (value !== undefined) {
                imagesToStoreinDB.push(value);
            }
        }
    });
    return await dbOperations.storeImages(imagesToStoreinDB);
}

async function createCacheThumbnail(filePathSource: string, imageName: string) {
    const [name] = imageName.split('.');
    const fileDestinationPath = join(appDirectories.thumbnails, name + '.webp');
    if (imageName.length > 0) {
        try {
            const buffer = Sharp(filePathSource, {
                animated: true,
                limitInputPixels: false
            });
            const metadata = await buffer.metadata();
            await buffer
                .resize(300, 200, {
                    fit: 'cover'
                })
                .webp({ quality: 60, force: true, effort: 6 })
                .toFile(fileDestinationPath);
            const imageMetadata = {
                name: imageName,
                format: metadata.format,
                width: metadata.width,
                height: metadata.height
            };
            return imageMetadata as imageMetadata;
        } catch (error) {
            console.error('failed to create thumbnail for:', imageName, error);
        }
    }
}

export async function openAndReturnImagesObject(
    action: openFileAction,
    browserWindow: BrowserWindow | null
) {
    const imagePathsFromFilePicker =
        action === 'file'
            ? openImagesFromFilePicker(browserWindow)
            : await openFolderFromFilePicker(browserWindow);
    if (imagePathsFromFilePicker === undefined) {
        return;
    }
    const fileNames = imagePathsFromFilePicker.map(image => basename(image));
    return { imagePaths: imagePathsFromFilePicker, fileNames };
}
async function remakeThumbnailImages(files: string[]) {
    for (let current = 0; current < files.length; current++) {
        const imageName = files[current];
        const filePathSource = join(appDirectories.imagesDir, imageName);
        const [name] = imageName.split('.');
        const fileDestinationPath = join(
            appDirectories.thumbnails,
            name + '.webp'
        );
        try {
            const buffer = Sharp(filePathSource, {
                animated: true,
                limitInputPixels: false
            });
            await buffer
                .resize(300, 200, {
                    fit: 'cover'
                })
                .webp({ quality: 60, force: true, effort: 6 })
                .toFile(fileDestinationPath);
        } catch (error) {
            console.error('failed to create thumbnail for:', imageName, error);
        }
    }
}
export async function remakeThumbnailsIfImagesExist() {
    const thumbnails = await readdir(appDirectories.thumbnails);
    if (thumbnails.length < 1) {
        const imagesStored = await readdir(appDirectories.imagesDir);
        if (imagesStored.length < 1) {
            return;
        }
        await remakeThumbnailImages(imagesStored);
    }
}
export function createAppDirsIfNotExist() {
    const directoriesToCreate: string[] = [
        appDirectories.rootCache,
        appDirectories.thumbnails,
        appDirectories.extendedImages,
        appDirectories.mainDir,
        appDirectories.imagesDir
    ];

    for (const directory of directoriesToCreate) {
        if (!existsSync(directory)) {
            createFolders(directory);
        }
    }
}

function createFolders(...args: string[]) {
    try {
        args.forEach(path => {
            mkdirSync(path);
        });
    } catch (error) {
        console.error(error);
    }
}

// function deleteFolders(...args: string[]) {
//     try {
//         args.forEach(path => {
//             rmSync(path, { recursive: true, force: true });
//         });
//     } catch (error) {
//         console.error(error);
//     }
// }

async function checkAndRenameDuplicates(filenamesToCopy: string[]) {
    const currentImagesStored = new Set(
        await readdir(appDirectories.imagesDir)
    );
    const correctFilenamesToCopy = getUniqueFileNames(
        currentImagesStored,
        filenamesToCopy
    );
    return correctFilenamesToCopy;
}

function getUniqueFileNames(existingFiles: Set<string>, filesToCopy: string[]) {
    const filesToCopyWithoutConflicts: string[] = [];
    const filesToCopyLength = filesToCopy.length;
    for (let i = 0; i < filesToCopyLength; i++) {
        const file = filesToCopy[i];
        const extensionIndex = file.lastIndexOf('.');
        const fileNameWithoutExtension =
            extensionIndex !== -1 ? file.substring(0, extensionIndex) : file;
        const fileExtension =
            extensionIndex !== -1 ? file.substring(extensionIndex) : '';

        let uniqueFileName = fileNameWithoutExtension;
        let count = 1;
        while (existingFiles.has(uniqueFileName + fileExtension)) {
            uniqueFileName = `${fileNameWithoutExtension}(${count})`;
            count++;
        }
        filesToCopyWithoutConflicts.push(uniqueFileName + fileExtension);
        existingFiles.add(uniqueFileName + fileExtension);
    }
    return filesToCopyWithoutConflicts;
}

export async function setImage(
    image: rendererImage | imageSelectType,
    activeMonitor: ActiveMonitor
) {
    let retries = 0;
    let success = false;
    while (retries < 3) {
        try {
            if (activeMonitor.extendAcrossMonitors) {
                await setImageAcrossMonitors(image, activeMonitor.monitors);
            } else {
                await duplicateImageAcrossMonitors(
                    image,
                    activeMonitor.monitors
                );
            }
            success = true;
            break;
        } catch (error) {
            console.error(error);
            initSwwwDaemon();
            retries++;
        }
    }
    if (success) {
        dbOperations.addImageToHistory({ image, activeMonitor });
    } else {
        throw new Error('Could not set image, check logs');
    }
}

export function savePlaylist(playlistObject: rendererPlaylist) {
    try {
        void dbOperations.upsertPlaylist(playlistObject);
    } catch (error) {
        console.error(error);
        throw Error('Failed to set playlist in DB');
    }
}

export function deleteImageFromStorage(images: rendererImage[]) {
    try {
        images.forEach(imageToDelete => {
            const [thumbnailName] = imageToDelete.name.split('.');
            rmSync(join(appDirectories.imagesDir, imageToDelete.name));
            rmSync(join(appDirectories.thumbnails, `${thumbnailName}.webp`), {
                force: true
            });
            if (imageToDelete.name.endsWith('.gif')) {
                rmSync(
                    join(appDirectories.thumbnails, `${thumbnailName}.gif`),
                    {
                        force: true
                    }
                );
            }
        });
    } catch (error) {
        console.error(error);
        throw new Error('Could not delete images from storage');
    }
}

export function deleteImagesFromGallery(
    _: Electron.IpcMainInvokeEvent,
    images: rendererImage[]
) {
    try {
        dbOperations.deleteImages(images);
        deleteImageFromStorage(images);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function getMonitors(): Promise<Monitor[]> {
    let stdout: string | undefined;
    let stderr: string | undefined;
    let tries = 0;
    while (tries < 3) {
        try {
            const result = await execPomisified('swww query', {
                encoding: 'utf-8'
            });
            stdout = result.stdout;
            stderr = result.stderr;
            break;
        } catch (error) {
            initSwwwDaemon();
            tries++;
        }
    }
    if (stdout === undefined || stderr === undefined) {
        throw new Error('Could not query swww');
    }
    const wlrOutput = await getMonitorsInfo();
    const parsedSwwwQuery = parseSwwwQuery(stdout);
    if (stderr.length > 0 || wlrOutput === undefined)
        throw new Error('either wlrOutput is undefined or swww query failed');
    return parsedSwwwQuery.map(swwwMonitor => {
        const matchingMonitor = wlrOutput.find(monitor => {
            return monitor.name === swwwMonitor.name;
        });
        if (matchingMonitor === undefined)
            throw new Error('Could not reconcile wlr_output and swww info');
        return {
            ...swwwMonitor,
            position: matchingMonitor.position
        };
    });
}

function parseSwwwQuery(stdout: string) {
    const monitorsInfoString = stdout.split('\n');
    const monitorsObjectArray = monitorsInfoString
        .filter(monitor => {
            return monitor !== '';
        })
        .map((monitor, index) => {
            const splitInfo = monitor.split(':');
            const resolutionString = splitInfo[1].split(',')[0].trim();
            const { width, height } = parseResolution(resolutionString);
            return {
                name: splitInfo[0].trim(),
                width,
                height,
                currentImage: splitInfo[4].trim(),
                position: index
            };
        });
    return monitorsObjectArray;
}

export async function getMonitorsInfo() {
    try {
        const { stdout } = await execFilePomisified(join(binDir, 'wlr-randr'), [
            '--json'
        ]);
        const monitors: wlr_output = JSON.parse(stdout);
        monitors.forEach(monitor => {
            monitor.modes = monitor.modes.filter(mode => mode.current);
        });
        return monitors;
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

export async function openContextMenu(
    event: Electron.IpcMainInvokeEvent,
    image: rendererImage | undefined,
    selectedImagesLength: number
) {
    const template = await contextMenu({
        selectedImagesLength,
        event,
        image
    });
    const contextMenuInstance = Menu.buildFromTemplate(template);
    contextMenuInstance.popup();
}

export function parseArgs<
    T extends { swwwFormat: string | undefined; script: string | undefined }
>(args: string[], configuration: T) {
    for (let idx = 0; idx < args.length; idx++) {
        const currentArg = args[idx];
        switch (currentArg) {
            case '--script':
                configuration.script = args[idx + 1];
                break;
            case '--format':
                configuration.swwwFormat = args[idx + 1];
                break;
            default:
                break;
        }
    }
}
