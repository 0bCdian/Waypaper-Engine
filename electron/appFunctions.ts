import { type BrowserWindow, dialog, Menu } from "electron";
import { rmSync, mkdirSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { contextMenu } from "../globals/menus";
import {
    type rendererImage,
} from "../src/types/rendererTypes";
import { join, basename } from "node:path";
import { configuration } from "../globals/config";
import { type openFileAction } from "../shared/types";
import { validImageExtensions } from "../shared/constants";
import { type Formats } from "../shared/types/image";
import { logger } from "../globals/setup";
const appDirectories = configuration.directories;
function openImagesFromFilePicker(browserWindow: BrowserWindow | null) {
    if (browserWindow !== null) {
        return dialog.showOpenDialogSync(browserWindow, {
            properties: ["openFile", "multiSelections"],
            filters: [{ name: "Images", extensions: validImageExtensions }],
            defaultPath: appDirectories.systemHome
        });
    }
    return dialog.showOpenDialogSync({
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "Images", extensions: validImageExtensions }],
        defaultPath: appDirectories.systemHome
    });
}

async function openFolderFromFilePicker(browserWindow: BrowserWindow | null) {
    let paths: string[] | undefined;
    if (browserWindow !== null) {
        paths = dialog.showOpenDialogSync(browserWindow, {
            properties: ["openDirectory", "multiSelections"],
            defaultPath: appDirectories.systemHome
        });
    } else {
        paths = dialog.showOpenDialogSync({
            properties: ["openDirectory", "multiSelections"],
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
        encoding: "utf-8",
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
                .split(".")
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



export async function openAndReturnImagesObject(
    action: openFileAction,
    browserWindow: BrowserWindow | null
) {
    const imagePathsFromFilePicker =
        action === "file"
            ? openImagesFromFilePicker(browserWindow)
            : await openFolderFromFilePicker(browserWindow);
    if (imagePathsFromFilePicker === undefined) {
        return;
    }
    const fileNames = imagePathsFromFilePicker.map(image => basename(image));
    return { imagePaths: imagePathsFromFilePicker, fileNames };
}
export function createAppDirsIfNotExist() {
    const directoriesToCreate: string[] = [
        appDirectories.rootCache,
        appDirectories.thumbnails,
        appDirectories.extendedImages,
        appDirectories.imagesDir,
        appDirectories.scriptsDir
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
        logger.error(error);
    }
}

export function deleteImageFromStorage(images: rendererImage[]) {
    try {
        images.forEach(imageToDelete => {
            const [thumbnailName] = imageToDelete.name.split(".");
            rmSync(join(appDirectories.imagesDir, imageToDelete.name));
            rmSync(join(appDirectories.thumbnails, `${thumbnailName}.webp`), {
                force: true
            });
            if (imageToDelete.name.endsWith(".gif")) {
                rmSync(
                    join(appDirectories.thumbnails, `${thumbnailName}.gif`),
                    {
                        force: true
                    }
                );
            }
        });
    } catch (error) {
        logger.error(error);
        throw new Error("Could not delete images from storage");
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
