/**
 * Centralized Store Exports for Waypaper Engine
 *
 * This file provides a centralized way to import all stores
 * and ensures consistent state management patterns.
 */

// Core stores
export { useAppConfigStore } from "./appConfig";
export { imagesStore } from "./images";
export { playlistStore } from "./playlist";
export { useMonitorStore } from "./monitors";
export { swwwConfigStore } from "./swwwConfig";
export { useImageProcessingStore } from "./imageProcessingStore";
export { useToastStore } from "./toastStore";

// Theme store (new)
// Theme store removed - using ThemeContext instead

// Settings store (new)
export { useSettingsStore } from "./settings";
export { useSettingsStore as useUnifiedSettingsStore } from "./settingsStore";

// Store utilities
export { createStore } from "./utils/createStore";

// Store types
export type { StoreState, StoreActions } from "./types";

// Store hooks
export { useStoreSelector } from "./hooks/useStoreSelector";
