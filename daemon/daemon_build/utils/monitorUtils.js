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
exports.getSwwwCommandFromConfiguration = exports.getMonitors = exports.getMonitorsInfo = exports.parseResolution = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const config_1 = require("../config/config");
const execPomisified = (0, node_util_1.promisify)(node_child_process_1.exec);
function parseResolution(resolution) {
    const [width, height] = resolution.split('x');
    return { width: parseInt(width), height: parseInt(height) };
}
exports.parseResolution = parseResolution;
function getMonitorsInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stdout } = yield execPomisified('wlr-randr --json', {
                encoding: 'utf-8'
            });
            const monitors = JSON.parse(stdout);
            monitors.forEach(monitor => {
                monitor.modes = monitor.modes.filter(mode => mode.current);
            });
            return monitors;
        }
        catch (error) {
            console.error(error);
            return undefined;
        }
    });
}
exports.getMonitorsInfo = getMonitorsInfo;
function getMonitors() {
    return __awaiter(this, void 0, void 0, function* () {
        const { stdout, stderr } = yield execPomisified('swww query', {
            encoding: 'utf-8'
        });
        const wlrOutput = yield getMonitorsInfo();
        const parsedSwwwQuery = parseSwwwQuery(stdout);
        if (stderr.length > 0 || wlrOutput === undefined)
            throw new Error('Could not execute swww query');
        return parsedSwwwQuery.map(swwwMonitor => {
            const matchingMonitor = wlrOutput.find(monitor => {
                return monitor.name === swwwMonitor.name;
            });
            if (matchingMonitor === undefined)
                throw new Error('Could not reconcile wlr_output and swww info');
            return Object.assign(Object.assign({}, swwwMonitor), { position: matchingMonitor.position });
        });
    });
}
exports.getMonitors = getMonitors;
function parseSwwwQuery(stdout) {
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
function getSwwwCommandFromConfiguration(imagePath, monitor) {
    const swwwConfig = config_1.configuration.swww.settings;
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
    const command = `swww img ${imagePath} ${monitor !== undefined ? `--outputs ${monitor}` : ''} --resize="${swwwConfig.resizeType}" --fill-color "${swwwConfig.fillColor}" --filter ${swwwConfig.filterType} --transition-type ${swwwConfig.transitionType} --transition-step ${swwwConfig.transitionStep} --transition-duration ${swwwConfig.transitionDuration} --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${swwwConfig.transitionAngle} --transition-pos ${transitionPos} ${inverty} --transition-bezier ${swwwConfig.transitionBezier} --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`;
    return command;
}
exports.getSwwwCommandFromConfiguration = getSwwwCommandFromConfiguration;
//# sourceMappingURL=monitorUtils.js.map