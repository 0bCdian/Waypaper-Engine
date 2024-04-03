"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateImageAcrossMonitors = exports.setImageAcrossMonitors = exports.extendImageAcrossMonitors = exports.resizeImageToFitMonitor = void 0;
const Sharp = require("sharp");
const config_1 = require("../config/config");
const appPaths_1 = require("../config/appPaths");
const node_path_1 = require("node:path");
const monitorUtils_1 = require("../utils/monitorUtils");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const notifications_1 = require("./notifications");
const execPomisified = (0, node_util_1.promisify)(node_child_process_1.exec);
function resizeImageToFitMonitor(buffer, Image, requiredWidth, requiredHeight) {
    return __awaiter(this, void 0, void 0, function* () {
        const widthDifferenceImageToMonitors = requiredWidth - Image.width;
        const heightDifferenceImageToCurrentMonitor = requiredHeight - Image.height;
        const resizedImageFileName = `${appPaths_1.appDirectories.tempImages}/resized.${Image.format}`;
        if (widthDifferenceImageToMonitors < 0 ||
            heightDifferenceImageToCurrentMonitor < 0) {
            yield buffer
                .resize({
                width: requiredWidth,
                height: requiredHeight,
                fit: 'cover',
                background: hexToSharpRgb(config_1.configuration.swww.settings.fillColor)
            })
                .toFile(resizedImageFileName);
        }
        else if (widthDifferenceImageToMonitors === 0 &&
            heightDifferenceImageToCurrentMonitor === 0) {
            yield buffer.toFile(resizedImageFileName);
        }
        else {
            yield buffer
                .resize({
                width: requiredWidth,
                height: requiredHeight,
                fit: 'fill',
                background: hexToSharpRgb(config_1.configuration.swww.settings.fillColor)
            })
                .toFile(resizedImageFileName);
        }
        return resizedImageFileName;
    });
}
exports.resizeImageToFitMonitor = resizeImageToFitMonitor;
function hexToSharpRgb(hex) {
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
function getDesiredDimensionsToExtendImage(Monitors) {
    const desiredDimensions = Monitors.reduce((previousValue, currentValue) => {
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
    }, { x: 0, y: 0 });
    return desiredDimensions;
}
function extendImageAcrossMonitors(image, imageFilePath, monitors) {
    return __awaiter(this, void 0, void 0, function* () {
        const monitorsToImagesPairsArray = [];
        for (let index = 0; index < monitors.length; index++) {
            const monitor = monitors[index];
            const monitorX = monitor.position.x === 0
                ? monitor.position.x
                : monitor.position.x - 1;
            const monitorY = monitor.position.y === 0
                ? monitor.position.y
                : monitor.position.y - 1;
            const finalImageName = (0, node_path_1.join)(appPaths_1.appDirectories.tempImages, `${index}.${image.format}`);
            const desiredDimensions = getDesiredDimensionsToExtendImage(monitors);
            const resizedImageFilename = yield resizeImageToDesiredResolution(desiredDimensions, Sharp(imageFilePath, {
                animated: true,
                limitInputPixels: false
            }));
            const buffer = Sharp(resizedImageFilename, {
                animated: true,
                limitInputPixels: false
            });
            yield buffer
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
    });
}
exports.extendImageAcrossMonitors = extendImageAcrossMonitors;
function resizeImageToDesiredResolution(desiredDimensions, buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        const { width, height, format } = yield buffer.metadata();
        if (width === undefined || height === undefined) {
            throw new Error('Image metadata is broken');
        }
        let finalWidth = width;
        let finalHeight = height;
        const resizedImageFileName = `${appPaths_1.appDirectories.tempImages}/resized.${format}`;
        if (finalWidth < desiredDimensions.x) {
            finalWidth = desiredDimensions.x;
        }
        if (finalHeight < desiredDimensions.y) {
            finalHeight = desiredDimensions.y;
        }
        yield buffer
            .resize({
            width: finalWidth,
            height: finalHeight,
            fit: 'cover',
            background: hexToSharpRgb(config_1.configuration.swww.settings.fillColor)
        })
            .toFile(resizedImageFileName);
        return resizedImageFileName;
    });
}
function setImageAcrossMonitors(image, monitors) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageFilePath = (0, node_path_1.join)(appPaths_1.appDirectories.imagesDir, image.name);
        try {
            const commands = [];
            const monitorsToImagesPair = yield extendImageAcrossMonitors(image, imageFilePath, monitors);
            monitorsToImagesPair.forEach(pair => {
                commands.push(execPomisified((0, monitorUtils_1.getSwwwCommandFromConfiguration)(pair.image, pair.monitor)));
            });
            void Promise.all(commands);
            if (config_1.configuration.script !== undefined) {
                yield execPomisified(`${config_1.configuration.script} ${imageFilePath}`);
            }
            (0, notifications_1.notifyImageSet)(image.name, imageFilePath);
        }
        catch (error) {
            console.error(error);
        }
    });
}
exports.setImageAcrossMonitors = setImageAcrossMonitors;
function duplicateImageAcrossMonitors(image, monitors) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageFilePath = (0, node_path_1.join)(appPaths_1.appDirectories.imagesDir, image.name);
        const monitorsString = monitors.reduce((prev, current) => {
            prev = prev.concat(current.name, ',');
            return prev;
        }, '');
        const command = (0, monitorUtils_1.getSwwwCommandFromConfiguration)(imageFilePath, monitorsString);
        try {
            void execPomisified(command);
            if (config_1.configuration.script !== undefined) {
                yield execPomisified(`${config_1.configuration.script} ${imageFilePath}`);
            }
            (0, notifications_1.notifyImageSet)(image.name, imageFilePath);
        }
        catch (error) {
            console.error(error);
        }
    });
}
exports.duplicateImageAcrossMonitors = duplicateImageAcrossMonitors;
//# sourceMappingURL=imageOperations.js.map