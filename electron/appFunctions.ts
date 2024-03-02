import { type BrowserWindow, dialog, Menu } from 'electron';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { copyFile, readdir } from 'node:fs/promises';
import {
    appDirectories,
    validImageExtensions,
    WAYPAPER_ENGINE_SOCKET_PATH,
    contextMenu
} from './globals/globals';
import {
    type imagesObject,
    ACTIONS,
    type message,
    type Monitor,
    type imageMetadata,
    type wlr_output
} from './types/types';
import {
    type rendererPlaylist,
    type Image,
    type openFileAction
} from '../src/types/rendererTypes';
import { exec, execFile, execSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { binDir, daemonLocation } from './binaries';
import { join, basename } from 'node:path';
import { createConnection } from 'node:net';
import { parseResolution } from '../src/utils/utilities';
import dbOperations from './database/dbOperations';
import config from './database/globalConfig';
import Sharp = require('sharp');
import {
    extendImageAcrossAllMonitors,
    splitImageHorizontalAxis,
    splitImageVerticalAxis
} from './imageOperations';
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
            const fileExtension = filePathOrDir.name.split('.').at(-1);
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
                return undefined;
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
    return dbOperations.storeImagesInDB(imagesToStoreinDB);
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

export async function remakeThumbnailsIfImagesExist() {
    const thumbnails = await readdir(appDirectories.thumbnails);
    if (thumbnails.length < 1) {
        const imagesStored = await readdir(appDirectories.imagesDir);
        if (imagesStored.length < 1) {
            return;
        }
        for (let current = 0; current < imagesStored.length; current++) {
            const filePathSource = join(
                appDirectories.imagesDir,
                imagesStored[current]
            );
            void createCacheThumbnail(filePathSource, imagesStored[current]);
        }
    }
}
export function checkCacheOrCreateItIfNotExists() {
    if (!existsSync(appDirectories.rootCache)) {
        createFolders(appDirectories.rootCache, appDirectories.thumbnails);
    } else {
        if (!existsSync(appDirectories.thumbnails)) {
            createFolders(appDirectories.thumbnails);
        }
    }
    if (!existsSync(appDirectories.mainDir)) {
        deleteFolders(appDirectories.thumbnails);
        createFolders(
            appDirectories.mainDir,
            appDirectories.imagesDir,
            appDirectories.thumbnails,
            appDirectories.tempImages
        );
    } else {
        if (!existsSync(appDirectories.imagesDir)) {
            deleteFolders(appDirectories.thumbnails);
            createFolders(appDirectories.imagesDir, appDirectories.thumbnails);
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

function deleteFolders(...args: string[]) {
    try {
        args.forEach(path => {
            rmSync(path, { recursive: true, force: true });
        });
    } catch (error) {
        console.error(error);
    }
}

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

export function setImage(
    _event: Electron.IpcMainInvokeEvent,
    imageName: string,
    monitor?: string
) {
    const imagePath = join(appDirectories.imagesDir, `"${imageName}"`);
    const command = getSwwwCommandFromConfiguration(imagePath, monitor);
    void execPomisified(`${command}`).then(output => {
        if (output.stderr.length > 0) {
            console.error(output.stderr);
            return;
        }
        if (config.script !== undefined) {
            void execPomisified(`${config.script} ${imagePath}`);
        }
    });
}

export async function isSwwwDaemonRunning() {
    await checkIfSwwwIsInstalled();
    try {
        execSync('ps -A | grep "swww-daemon"');
        console.log('Swww daemon already running');
    } catch (error) {
        console.log('daemon not running, initiating swww...');
        await execPomisified('swww init');
    }
}

export async function checkIfSwwwIsInstalled() {
    const { stdout } = await execPomisified(`swww --version`);
    if (stdout.length > 0) {
        console.info('swww is installed in the system');
    } else {
        console.warn(
            'swww is not installed, please find instructions in the README.md on how to install it'
        );
        throw new Error('swww is not installed');
    }
}
export function savePlaylist(playlistObject: rendererPlaylist) {
    try {
        if (dbOperations.checkIfPlaylistExists(playlistObject.name)) {
            dbOperations.updatePlaylistInDB(playlistObject);
        } else {
            dbOperations.storePlaylistInDB(playlistObject);
        }
        if (isSavedPlaylistActive(playlistObject)) {
            PlaylistController.updatePlaylist();
        } else {
            PlaylistController.startPlaylist();
        }
    } catch (error) {
        console.error(error);
        throw Error('Failed to set playlist in DB');
    }
}
async function isWaypaperDaemonRunning() {
    try {
        await execPomisified('pidof wpe-daemon');
        return true;
    } catch (_err) {
        return false;
    }
}
export async function initWaypaperDaemon() {
    if (!(await isWaypaperDaemonRunning())) {
        const promise = new Promise<void>((resolve, reject) => {
            try {
                const args = [`${daemonLocation}/daemon.js`];
                if (config.script !== undefined)
                    args.push(`--script=${config.script}`);
                spawn('node', args, {
                    detached: true,
                    stdio: 'ignore',
                    shell: true
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
        await promise;
    }
}

function playlistConnectionBridge(message: message) {
    const connection = createConnection(WAYPAPER_ENGINE_SOCKET_PATH);
    connection.on('connect', () => {
        connection.write(JSON.stringify(message));
    });
    connection.on('data', data => {
        const message = data.toString();
        // TODO do stuff based on the daemon's response, to sync with the cli tool actions.
        console.log(message);
    });
    connection.on('error', () => {
        void initWaypaperDaemon().then(() => {
            connection.destroy();
            setTimeout(() => {
                playlistConnectionBridge(message);
            }, 1000);
        });
    });
}

export const PlaylistController = {
    startPlaylist: function () {
        playlistConnectionBridge({
            action: ACTIONS.START_PLAYLIST
        });
    },
    pausePlaylist: () => {
        playlistConnectionBridge({
            action: ACTIONS.PAUSE_PLAYLIST
        });
    },
    resumePlaylist: () => {
        playlistConnectionBridge({
            action: ACTIONS.RESUME_PLAYLIST
        });
    },
    stopPlaylist: () => {
        playlistConnectionBridge({
            action: ACTIONS.STOP_PLAYLIST
        });
    },
    nextImage: () => {
        playlistConnectionBridge({
            action: ACTIONS.NEXT_IMAGE
        });
    },
    previousImage: () => {
        playlistConnectionBridge({
            action: ACTIONS.PREVIOUS_IMAGE
        });
    },
    randomImage: () => {
        playlistConnectionBridge({
            action: ACTIONS.RANDOM_IMAGE
        });
    },
    killDaemon: () => {
        playlistConnectionBridge({
            action: ACTIONS.STOP_DAEMON
        });
    },
    updateConfig: () => {
        playlistConnectionBridge({
            action: ACTIONS.UPDATE_CONFIG
        });
    },
    updatePlaylist: () => {
        playlistConnectionBridge({ action: ACTIONS.UPDATE_PLAYLIST });
    }
};

export function deleteImageFromStorage(imageName: string) {
    try {
        const [thumbnailName] = imageName.split('.');

        rmSync(join(appDirectories.imagesDir, imageName));
        rmSync(join(appDirectories.thumbnails, `${thumbnailName}.webp`), {
            force: true
        });
        if (imageName.endsWith('.gif')) {
            rmSync(join(appDirectories.thumbnails, `${thumbnailName}.gif`), {
                force: true
            });
        }
    } catch (error) {
        console.error(error);
        throw new Error('Could not delete images from storage');
    }
}

export function deleteImageFromGallery(
    _: Electron.IpcMainInvokeEvent,
    imageID: number,
    imageName: string
) {
    try {
        dbOperations.deleteImageInDB(imageID);
        deleteImageFromStorage(imageName);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

function getSwwwCommandFromConfiguration(imagePath: string, monitor?: string) {
    const swwwConfig = config.swww.config;
    let transitionPos = '';
    const inverty = swwwConfig.invertY !== 0 ? '--invert-y' : '';
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
    const command = `swww img ${imagePath} ${
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

export async function getMonitors() {
    const { stdout, stderr } = await execPomisified('swww query', {
        encoding: 'utf-8'
    });
    if (stderr.length > 0) throw new Error('Could not execute swww query');
    return parseSwwwQuery(stdout);
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
    return monitorsObjectArray as Monitor[];
}

export async function setImageExtended(
    Image: Image,
    monitors: Monitor[],
    orientation: 'vertical' | 'horizontal'
) {
    try {
        const commands: Array<Promise<any>> = [];
        const imageFilePath = join(appDirectories.imagesDir, Image.name);
        let combinedMonitorHeight: number = 0;
        let combinedMonitorWidth: number = 0;
        monitors.forEach(monitor => {
            combinedMonitorHeight += monitor.height;
            combinedMonitorWidth += monitor.width;
        });
        const monitorsToImagesPair =
            orientation === 'vertical'
                ? await splitImageVerticalAxis(
                      monitors,
                      Image,
                      imageFilePath,
                      combinedMonitorWidth
                  )
                : await splitImageHorizontalAxis(
                      monitors,
                      Image,
                      imageFilePath,
                      combinedMonitorHeight
                  );
        monitorsToImagesPair.forEach(pair => {
            commands.push(
                execPomisified(
                    getSwwwCommandFromConfiguration(pair.image, pair.monitor)
                )
            );
        });
        void Promise.all(commands);
        if (config.script !== undefined) {
            await execPomisified(`${config.script} ${imageFilePath}`);
        }
    } catch (error) {
        console.error(error);
    }
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

export async function setImageAcrossAllMonitors(Image: Image) {
    const imageFilePath = join(appDirectories.imagesDir, Image.name);
    try {
        const commands: Array<Promise<any>> = [];
        const monitorsToImagesPair = await extendImageAcrossAllMonitors(
            Image,
            imageFilePath
        );
        monitorsToImagesPair.forEach(pair => {
            commands.push(
                execPomisified(
                    getSwwwCommandFromConfiguration(pair.image, pair.monitor)
                )
            );
        });
        void Promise.all(commands);
        if (config.script !== undefined) {
            await execPomisified(`${config.script} ${imageFilePath}`);
        }
    } catch (error) {
        console.error(error);
    }
}

function isSavedPlaylistActive(playlist: rendererPlaylist) {
    const activePlaylist = dbOperations.getCurrentPlaylist();
    return activePlaylist?.name === playlist.name;
}

export async function openContextMenu(
    event: Electron.IpcMainInvokeEvent,
    image: Image,
    win: BrowserWindow
) {
    const monitors = await getMonitors();
    const subLabelsMonitors = monitors.map(monitor => {
        return {
            label: `In ${monitor.name}`,
            click: () => {
                setImage(event, image.name, monitor.name);
            }
        };
    });
    subLabelsMonitors.unshift(
        {
            label: `Duplicate across all monitors`,
            click: () => {
                setImage(event, image.name);
            }
        },
        {
            label: `Extend across all monitors horizontally`,
            click: () => {
                void setImageExtended(image, monitors, 'vertical');
            }
        },
        {
            label: `Extend across all monitors vertically`,
            click: () => {
                void setImageExtended(image, monitors, 'horizontal');
            }
        },
        {
            label: `Extend across all monitors grouping them`,
            click: () => {
                void setImageAcrossAllMonitors(image);
            }
        }
    );
    const imageContextMenu = Menu.buildFromTemplate([
        {
            label: `Set ${image.name}`,
            submenu: subLabelsMonitors
        },
        {
            label: `Delete ${image.name}`,
            click: () => {
                void dialog
                    .showMessageBox(win, {
                        message: `Are you sure you want to delete ${image.name}`,
                        type: 'question',
                        buttons: ['yes', 'no'],
                        title: 'Confirm delete'
                    })
                    .then(data => {
                        if (data.response === 0) {
                            deleteImageFromGallery(event, image.id, image.name);
                            win?.webContents.send(
                                'deleteImageFromGallery',
                                image
                            );
                        }
                    });
            }
        },
        ...contextMenu
    ]);
    imageContextMenu.popup();
}

export function openContextMenuGallery(win: BrowserWindow) {
    const galleryContextMenu = Menu.buildFromTemplate(contextMenu);
    galleryContextMenu.popup();
}
