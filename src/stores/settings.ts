/**
 * Settings Store for Waypaper Engine
 *
 * Zustand store for managing application settings and preferences.
 * Provides centralized configuration management.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Settings interface
 */
export interface AppSettings {
	// UI Settings
	sidebarCollapsed: boolean;
	sidebarWidth: number;
	showSidebar: boolean;

	// Gallery Settings
	imagesPerPage: number;
	imageSize: "small" | "medium" | "large";
	showImageInfo: boolean;
	showImageMetadata: boolean;

	// Playlist Settings
	autoStartPlaylist: boolean;
	playlistInterval: number; // in seconds
	shufflePlaylist: boolean;

	// Display Settings
	showNotifications: boolean;
	minimizeToTray: boolean;
	startMinimized: boolean;

	// Performance Settings
	enableImageCaching: boolean;
	maxCacheSize: number; // in MB
	enableThumbnails: boolean;

	// Advanced Settings
	enableDebugMode: boolean;
	logLevel: "error" | "warn" | "info" | "debug";
	enableAnalytics: boolean;
}

/**
 * Default settings
 */
const defaultSettings: AppSettings = {
	// UI Settings
	sidebarCollapsed: false,
	sidebarWidth: 256,
	showSidebar: true,

	// Gallery Settings
	imagesPerPage: 20,
	imageSize: "medium",
	showImageInfo: true,
	showImageMetadata: false,

	// Playlist Settings
	autoStartPlaylist: false,
	playlistInterval: 30,
	shufflePlaylist: false,

	// Display Settings
	showNotifications: true,
	minimizeToTray: true,
	startMinimized: false,

	// Performance Settings
	enableImageCaching: true,
	maxCacheSize: 500,
	enableThumbnails: true,

	// Advanced Settings
	enableDebugMode: false,
	logLevel: "info",
	enableAnalytics: false,
};

/**
 * Settings store state interface
 */
interface SettingsStoreState {
	settings: AppSettings;
	isLoading: boolean;
	isDirty: boolean;
	lastSaved: number | null;
}

/**
 * Settings store actions interface
 */
interface SettingsStoreActions {
	// Settings management
	updateSetting: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
	updateSettings: (updates: Partial<AppSettings>) => void;
	resetSettings: () => void;
	resetToDefaults: () => void;

	// Settings persistence
	saveSettings: () => Promise<void>;
	loadSettings: () => Promise<void>;

	// Settings validation
	validateSettings: (settings: AppSettings) => AppSettings;

	// Settings utilities
	exportSettings: () => string;
	importSettings: (settingsJson: string) => Promise<void>;
	getSetting: <K extends keyof AppSettings>(key: K) => AppSettings[K];
	hasSetting: <K extends keyof AppSettings>(key: K) => boolean;
}

/**
 * Settings store type
 */
type SettingsStore = SettingsStoreState & SettingsStoreActions;

/**
 * Create settings store
 */
export const useSettingsStore = create<SettingsStore>()(
	persist(
		(set, get) => ({
			// Initial state
			settings: defaultSettings,
			isLoading: false,
			isDirty: false,
			lastSaved: null,

			// Settings management
			updateSetting: <K extends keyof AppSettings>(
				key: K,
				value: AppSettings[K],
			) => {
				const state = get();
				const newSettings = { ...state.settings, [key]: value };

				set({
					settings: newSettings,
					isDirty: true,
				});

				// Auto-save after a delay
				setTimeout(() => {
					get().saveSettings();
				}, 1000);
			},

			updateSettings: (updates: Partial<AppSettings>) => {
				const state = get();
				const newSettings = { ...state.settings, ...updates };

				set({
					settings: newSettings,
					isDirty: true,
				});

				// Auto-save after a delay
				setTimeout(() => {
					get().saveSettings();
				}, 1000);
			},

			resetSettings: () => {
				set({
					settings: defaultSettings,
					isDirty: true,
				});
			},

			resetToDefaults: () => {
				set({
					settings: defaultSettings,
					isDirty: true,
				});

				// Auto-save
				setTimeout(() => {
					get().saveSettings();
				}, 1000);
			},

			// Settings persistence
			saveSettings: async () => {
				const state = get();
				if (!state.isDirty) return;

				set({ isLoading: true });

				try {
					// Validate settings before saving
					const validatedSettings = get().validateSettings(state.settings);

					// Save to frontend config via Go daemon
					if (window.API_RENDERER?.goDaemon) {
						await window.API_RENDERER.goDaemon.setFrontendConfig({
							settings: validatedSettings,
						});
					}

					set({
						isDirty: false,
						lastSaved: Date.now(),
						isLoading: false,
					});

					console.log("Settings saved successfully");
				} catch (error) {
					console.error("Failed to save settings:", error);
					set({ isLoading: false });
				}
			},

			loadSettings: async () => {
				set({ isLoading: true });

				try {
					// Load from frontend config via Go daemon
					if (window.API_RENDERER?.goDaemon) {
						const config =
							await window.API_RENDERER.goDaemon.getFrontendConfig();
						const loadedSettings = (config as any)?.settings || defaultSettings;

						// Validate loaded settings
						const validatedSettings = get().validateSettings(loadedSettings);

						set({
							settings: validatedSettings,
							isLoading: false,
						});

						console.log("Settings loaded successfully");
					} else {
						set({ isLoading: false });
					}
				} catch (error) {
					console.error("Failed to load settings:", error);
					set({ isLoading: false });
				}
			},

			// Settings validation
			validateSettings: (settings: AppSettings): AppSettings => {
				const validated: AppSettings = { ...defaultSettings };

				// Validate each setting
				Object.keys(defaultSettings).forEach((key) => {
					const settingKey = key as keyof AppSettings;
					const value = settings[settingKey];

					// Type validation
					if (typeof value === typeof defaultSettings[settingKey]) {
						(validated as any)[settingKey] = value;
					} else {
						console.warn(`Invalid setting value for ${key}:`, value);
						(validated as any)[settingKey] = defaultSettings[settingKey];
					}
				});

				// Range validation
				if (validated.imagesPerPage < 1 || validated.imagesPerPage > 100) {
					validated.imagesPerPage = defaultSettings.imagesPerPage;
				}

				if (
					validated.playlistInterval < 1 ||
					validated.playlistInterval > 3600
				) {
					validated.playlistInterval = defaultSettings.playlistInterval;
				}

				if (validated.maxCacheSize < 10 || validated.maxCacheSize > 10000) {
					validated.maxCacheSize = defaultSettings.maxCacheSize;
				}

				return validated;
			},

			// Settings utilities
			exportSettings: (): string => {
				const state = get();
				return JSON.stringify(
					{
						settings: state.settings,
						exportedAt: Date.now(),
						version: "1.0.0",
					},
					null,
					2,
				);
			},

			importSettings: async (settingsJson: string) => {
				try {
					const data = JSON.parse(settingsJson);

					if (!data.settings) {
						throw new Error("Invalid settings format");
					}

					// Validate imported settings
					const validatedSettings = get().validateSettings(data.settings);

					set({
						settings: validatedSettings,
						isDirty: true,
					});

					// Auto-save
					await get().saveSettings();

					console.log("Settings imported successfully");
				} catch (error) {
					console.error("Failed to import settings:", error);
					throw error;
				}
			},

			getSetting: <K extends keyof AppSettings>(key: K): AppSettings[K] => {
				return get().settings[key];
			},

			hasSetting: <K extends keyof AppSettings>(key: K): boolean => {
				return key in get().settings;
			},
		}),
		{
			name: "waypaper-settings-storage",
			partialize: (state) => ({
				settings: state.settings,
				lastSaved: state.lastSaved,
			}),
		},
	),
);

/**
 * Settings store selectors
 */
export const useAppSettings = () => useSettingsStore((state) => state.settings);
export const useSetting = <K extends keyof AppSettings>(key: K) =>
	useSettingsStore((state) => state.settings[key]);
export const useIsSettingsLoading = () =>
	useSettingsStore((state) => state.isLoading);
export const useIsSettingsDirty = () =>
	useSettingsStore((state) => state.isDirty);
export const useLastSaved = () => useSettingsStore((state) => state.lastSaved);

/**
 * Settings store actions
 */
export const useSettingsActions = () =>
	useSettingsStore((state) => ({
		updateSetting: state.updateSetting,
		updateSettings: state.updateSettings,
		resetSettings: state.resetSettings,
		resetToDefaults: state.resetToDefaults,
		saveSettings: state.saveSettings,
		loadSettings: state.loadSettings,
		exportSettings: state.exportSettings,
		importSettings: state.importSettings,
		getSetting: state.getSetting,
		hasSetting: state.hasSetting,
	}));

export default useSettingsStore;
