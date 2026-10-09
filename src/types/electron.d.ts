import type { ElectronAPI } from "../../electron/preload";

declare global {
  interface Window {
    API_RENDERER: ElectronAPI;
  }
}
