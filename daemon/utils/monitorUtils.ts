import { type wlr_output, type Monitor } from '../types/monitor';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { configuration } from '../config/config';
const execPomisified = promisify(exec);

export function parseResolution(resolution: string) {
    const [width, height] = resolution.split('x');
    return { width: parseInt(width), height: parseInt(height) };
}

export async function getMonitorsInfo() {
    try {
        const { stdout } = await execPomisified('wlr-randr --json', {
            encoding: 'utf-8'
        });
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
export async function getMonitors(): Promise<Monitor[]> {
    const { stdout, stderr } = await execPomisified('swww query', {
        encoding: 'utf-8'
    });
    const wlrOutput = await getMonitorsInfo();
    const parsedSwwwQuery = parseSwwwQuery(stdout);
    if (stderr.length > 0 || wlrOutput === undefined)
        throw new Error('Could not execute swww query');
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

export function getSwwwCommandFromConfiguration(
    imagePath: string,
    monitor: string,
    showAnimations: boolean
) {
    const swwwConfig = configuration.swww.settings;
    let transitionPos = '';
    const transitionType = showAnimations ? swwwConfig.transitionType : 'none';
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
    const command = `swww img ${imagePath} ${
        monitor !== undefined ? `--outputs ${monitor}` : ''
    } --resize="${swwwConfig.resizeType}" --fill-color "${
        swwwConfig.fillColor
    }" --filter ${swwwConfig.filterType} --transition-type ${transitionType} --transition-step ${swwwConfig.transitionStep} --transition-duration ${
        swwwConfig.transitionDuration
    } --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${
        swwwConfig.transitionAngle
    } --transition-pos ${transitionPos} ${inverty} --transition-bezier ${
        swwwConfig.transitionBezier
    } --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`;
    return command;
}
