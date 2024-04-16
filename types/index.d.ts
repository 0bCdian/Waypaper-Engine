import { type ELECTRON_API_TYPE } from '../exposedApi';

declare global {
    interface Window {
        API_RENDERER: ELECTRON_API_TYPE;
    }
}
