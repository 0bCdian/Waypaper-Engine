"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_child_process_1 = require("node:child_process");
var node_util_1 = require("node:util");
var execPomisified = (0, node_util_1.promisify)(node_child_process_1.exec);
var sharp = require('sharp');
sharp('./dual_monitor_full_hd.jpg')
    .extract({ left: 0, top: 0, width: 1920, height: 1080 }) // Specify the dimensions of the first part
    .toFile('./first_part.jpg', function (err) {
    if (err) {
        console.error(err);
    }
    else {
        console.log('First part saved successfully');
    }
});
sharp('./dual_monitor_full_hd.jpg')
    .resize({ width: 1920, height: 1080 }) // Adjust the dimensions as per your requirement
    .extract({ left: 1920, top: 0, width: 1920, height: 1080 }) // Specify the dimensions of the second part
    .toFile('./second_part.jpg', function (err) {
    if (err) {
        console.error(err);
    }
    else {
        console.log('Second part saved successfully');
    }
});
