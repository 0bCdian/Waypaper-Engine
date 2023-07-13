"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var playlistType;
(function (playlistType) {
    playlistType["TIMER"] = "timer";
    playlistType["DAY_OF_WEEK"] = "daily";
    playlistType["HOUR_OF_DAY"] = "scheduled";
})(playlistType || (playlistType = {}));
//tiene que llegar, configs del swww, el playlist object, path to swww, appDirpath
process.on('message', function (message) {
    playlistPlayer(message);
});
function setImage(swwwConfigs, imagePath, swwwBin) {
    var optionsToPass = __spreadArray([], swwwConfigs, true);
    console.log(imagePath);
    optionsToPass.push(imagePath);
    (0, child_process_1.execFile)(swwwBin, optionsToPass, function (error) {
        console.log(error);
    });
}
function playlistPlayer(message) {
    setInterval(function () {
        setImage(message.swwwConfig, "".concat(message.appDirectories.imagesDir).concat(message.playlistObject.imagesList[message.playlistObject.currentImageIndex]), message.swwwBin);
        if (message.playlistObject.currentImageIndex ===
            message.playlistObject.imagesList.length) {
            message.playlistObject.currentImageIndex = 0;
        }
        else {
            message.playlistObject.currentImageIndex++;
        }
    }, message.playlistObject.interval);
}
