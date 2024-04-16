import { initSwwwDaemon } from '../globals/startDaemons';
import { type wlr_output, type Monitor } from '../shared/types/monitor';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { parseResolution } from '../src/utils/utilities';
const execPomisified = promisify(exec);

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
