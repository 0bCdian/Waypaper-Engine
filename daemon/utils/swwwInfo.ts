import { promisify } from "node:util";
import { exec } from "node:child_process";
import { type Monitor } from "../types/daemonTypes";
const execPomisified = promisify(exec);

function parseSwwwQuery(stdout: string) {
    const monitorsInfoString = stdout.split("\n");
    const monitorsObjectArray = monitorsInfoString
        .filter(monitor => {
            return monitor !== "";
        })
        .map((monitor, index) => {
            const splitInfo = monitor.split(":");
            const resolutionString = splitInfo[1].split(",")[0].trim();
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
function parseResolution(resolution: string) {
    const [width, height] = resolution.split("x");
    return { width: parseInt(width), height: parseInt(height) };
}
export async function getMonitors() {
    const { stdout, stderr } = await execPomisified("swww query", {
        encoding: "utf-8"
    });
    if (stderr.length > 0) throw new Error("Could not execute swww query");
    return parseSwwwQuery(stdout);
}
