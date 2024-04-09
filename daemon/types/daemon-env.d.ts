/// <reference types="vite-plugin-electron/electron-env" />
import { type SWWW_VERSION } from './types/types';
declare namespace NodeJS {
    interface ProcessEnv {
        /**
         * The built directory structure
         *
         * ```tree
         * ├─┬─┬ dist
         * │ │ └── index.html
         * │ │
         * │ ├─┬ dist-electron
         * │ │ ├── main.js
         * │ │ └── preload.js
         * │
         * ```
         */
        DIST: string;
        /** /dist/ or /public/ */
        PUBLIC: string;
        SWWW_VERSION: SWWW_VERSION;
        IS_PROD: string;
    }
}
