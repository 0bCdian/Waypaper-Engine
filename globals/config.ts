import { homedir } from "node:os";
import { join } from "node:path";
import { values } from "./setup";
import chokidar from "chokidar";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
const systemHome = homedir();
const cacheDirectoryRoot = join(systemHome, ".cache", "waypaper_engine");
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, "thumbnails");
const mainDirectory = join(systemHome, ".waypaper_engine");
const imagesDir = join(mainDirectory, "images");
const scriptsDir = join(mainDirectory, "scripts");
const extendedImages = join(cacheDirectoryRoot, "extended_images_cache");
const WAYPAPER_ENGINE_DAEMON_SOCKET_PATH = "/tmp/waypaper_engine_daemon.sock";
const WAYPAPER_ENGINE_SOCKET_PATH = "/tmp/waypaper_engine.sock";
const DAEMON_LOCK_FILE = "/tmp/waypaper-daemon.lock";
const DAEMON_PID = "waypaper-daemon";
const appDirectories = {
    systemHome,
    rootCache: cacheDirectoryRoot,
    thumbnails: cacheThumbnailsDirectory,
    mainDir: mainDirectory,
    imagesDir,
    scriptsDir,
    extendedImages,
    WAYPAPER_ENGINE_SOCKET_PATH,
    WAYPAPER_ENGINE_DAEMON_SOCKET_PATH,
    DAEMON_LOCK_FILE
};
let scripts: string[] = [];
if (!existsSync(scriptsDir)) {
    mkdirSync(scriptsDir);
}
scripts = readdirSync(scriptsDir).map(fileName => {
    return join(scriptsDir, fileName);
});

// Default configurations - now managed by Go daemon
const defaultSwwwConfig = {
    format: "xrgb",
    transitionType: "simple",
    transitionDuration: 300,
    transitionFps: 60,
    transitionAngle: 0,
    transitionStep: 90,
    transitionWave: 20,
    transitionPosition: "center",
    transitionBezier: "0.4,0.0,0.2,1",
    transitionGravity: "center",
    transitionWipe: 0,
    transitionWipeAngle: 0,
    transitionWipeClockwise: false,
    transitionWipeT: 0,
    transitionWipeBlend: false,
    transitionWipeInvert: false,
    transitionWipeMirror: false,
    transitionWipeReverse: false,
    transitionWipeY: 0,
    transitionWipeX: 0,
    transitionWipeDelta: 0,
    transitionWipeFade: false,
    transitionWipeGrow: false,
    transitionWipeShrink: false,
    transitionWipeZoom: false,
    transitionWipeRotate: false,
    transitionWipeScale: false,
    transitionWipeSkew: false,
    transitionWipePerspective: false,
    transitionWipeTransform: false,
    transitionWipeMatrix: false,
    transitionWipeQuaternion: false,
    transitionWipeAxis: false,
    transitionWipeAngle2: 0,
    transitionWipeClockwise2: false,
    transitionWipeT2: 0,
    transitionWipeBlend2: false,
    transitionWipeInvert2: false,
    transitionWipeMirror2: false,
    transitionWipeReverse2: false,
    transitionWipeY2: 0,
    transitionWipeX2: 0,
    transitionWipeDelta2: 0,
    transitionWipeFade2: false,
    transitionWipeGrow2: false,
    transitionWipeShrink2: false,
    transitionWipeZoom2: false,
    transitionWipeRotate2: false,
    transitionWipeScale2: false,
    transitionWipeSkew2: false,
    transitionWipePerspective2: false,
    transitionWipeTransform2: false,
    transitionWipeMatrix2: false,
    transitionWipeQuaternion2: false,
    transitionWipeAxis2: false
};

const defaultAppConfig = {
    startMinimized: false,
    minimizeInsteadOfClose: true,
    killDaemon: true,
    autoStart: false,
    checkForUpdates: true,
    theme: "dark",
    language: "en",
    notifications: true,
    soundEffects: true,
    animations: true,
    hardwareAcceleration: true,
    experimentalFeatures: false,
    debugMode: false,
    logLevel: "info",
    maxLogFiles: 10,
    logRotation: true,
    backupEnabled: true,
    backupInterval: 24,
    maxBackups: 7,
    autoCleanup: true,
    cleanupInterval: 168,
    maxCacheSize: 1024,
    thumbnailQuality: 80,
    thumbnailSize: 300,
    imageQuality: 90,
    imageCompression: true,
    watermarkEnabled: false,
    watermarkText: "",
    watermarkPosition: "bottom-right",
    watermarkOpacity: 0.5,
    watermarkFontSize: 12,
    watermarkFontFamily: "Arial",
    watermarkColor: "#ffffff",
    watermarkBackground: "#000000",
    watermarkPadding: 5,
    watermarkBorderRadius: 3,
    watermarkShadow: true,
    watermarkBlur: 0,
    watermarkRotate: 0,
    watermarkScale: 1,
    watermarkSkew: 0,
    watermarkPerspective: 0,
    watermarkTransform: false,
    watermarkMatrix: false,
    watermarkQuaternion: false,
    watermarkAxis: false,
    watermarkAngle: 0,
    watermarkClockwise: false,
    watermarkT: 0,
    watermarkBlend: false,
    watermarkInvert: false,
    watermarkMirror: false,
    watermarkReverse: false,
    watermarkY: 0,
    watermarkX: 0,
    watermarkDelta: 0,
    watermarkFade: false,
    watermarkGrow: false,
    watermarkShrink: false,
    watermarkZoom: false,
    watermarkRotate2: false,
    watermarkScale2: false,
    watermarkSkew2: false,
    watermarkPerspective2: false,
    watermarkTransform2: false,
    watermarkMatrix2: false,
    watermarkQuaternion2: false,
    watermarkAxis2: false,
    watermarkAngle2: 0,
    watermarkClockwise2: false,
    watermarkT2: 0,
    watermarkBlend2: false,
    watermarkInvert2: false,
    watermarkMirror2: false,
    watermarkReverse2: false,
    watermarkY2: 0,
    watermarkX2: 0,
    watermarkDelta2: 0,
    watermarkFade2: false,
    watermarkGrow2: false,
    watermarkShrink2: false,
    watermarkZoom2: false
};

const configuration = {
    swww: {
        config: defaultSwwwConfig,
        update: () => {
            // Configuration updates now handled by Go daemon
            console.log("Configuration updates now handled by Go daemon");
        }
    },
    app: {
        config: defaultAppConfig,
        update: () => {
            // Configuration updates now handled by Go daemon
            console.log("Configuration updates now handled by Go daemon");
        }
    },
    DAEMON_PID,
    directories: appDirectories,
    scripts,

    format: (values.format ?? false) as boolean,
    logs: (values.logs ?? false) as boolean
};
const watcher = chokidar.watch(scriptsDir, { persistent: true });
watcher
    .on("add", () => {
        configuration.scripts = readdirSync(scriptsDir).map(fileName => {
            return join(scriptsDir, fileName);
        });
    })
    .on("remove", () => {
        configuration.scripts = readdirSync(scriptsDir).map(fileName => {
            return join(scriptsDir, fileName);
        });
    });
export { configuration };
